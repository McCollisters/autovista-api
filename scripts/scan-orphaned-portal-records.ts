#!/usr/bin/env tsx
/**
 * Scan orders and quotes for missing or orphaned portal references.
 *
 * Usage:
 *   NODE_ENV=production tsx -r dotenv/config scripts/scan-orphaned-portal-records.ts
 *   NODE_ENV=production tsx -r dotenv/config scripts/scan-orphaned-portal-records.ts --limit=25
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { logger } from "../src/core/logger";

interface ScriptOptions {
  limit: number;
}

interface CollectionConfig {
  label: string;
  collectionName: string;
  portalField: string;
  fallbackPortalField?: string;
  sampleFields: Record<string, string | number>;
}

const parseArgs = (): ScriptOptions => {
  const limitArg = process.argv
    .slice(2)
    .find((arg) => arg.startsWith("--limit="));
  const parsedLimit = limitArg ? Number(limitArg.split("=")[1]) : 20;

  return {
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20,
  };
};

const formatDate = (value: unknown) => {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toISOString();
};

const buildPortalRefExpression = ({
  portalField,
  fallbackPortalField,
}: CollectionConfig) => {
  if (!fallbackPortalField) {
    return `$${portalField}`;
  }

  return {
    $ifNull: [`$${portalField}`, `$${fallbackPortalField}`],
  };
};

const scanCollection = async (
  collectionConfig: CollectionConfig,
  options: ScriptOptions,
) => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection is not ready.");
  }

  const collection = db.collection(collectionConfig.collectionName);
  const portalRefExpression = buildPortalRefExpression(collectionConfig);

  const [summary] = await collection
    .aggregate([
      {
        $addFields: {
          __portalRef: portalRefExpression,
        },
      },
      {
        $lookup: {
          from: "portals",
          localField: "__portalRef",
          foreignField: "_id",
          as: "__portal",
        },
      },
      {
        $match: {
          $or: [
            { __portalRef: { $exists: false } },
            { __portalRef: null },
            { __portal: { $eq: [] } },
            { "__portal.companyName": { $in: [null, ""] } },
          ],
        },
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                missingPortalRef: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $eq: [{ $type: "$__portalRef" }, "missing"] },
                          { $eq: ["$__portalRef", null] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                unresolvedPortalRef: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $ne: [{ $type: "$__portalRef" }, "missing"] },
                          { $ne: ["$__portalRef", null] },
                          { $eq: ["$__portal", []] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                blankPortalName: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gt: [{ $size: "$__portal" }, 0] },
                          {
                            $in: [
                              { $arrayElemAt: ["$__portal.companyName", 0] },
                              [null, ""],
                            ],
                          },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          byPortalRef: [
            {
              $group: {
                _id: "$__portalRef",
                count: { $sum: 1 },
                sampleRefIds: { $push: "$refId" },
                latestCreatedAt: { $max: "$createdAt" },
              },
            },
            { $sort: { count: -1 } },
            { $limit: options.limit },
          ],
          samples: [
            { $sort: { createdAt: -1 } },
            { $limit: options.limit },
            {
              $project: {
                ...collectionConfig.sampleFields,
                portalRef: "$__portalRef",
              },
            },
          ],
        },
      },
    ])
    .toArray();

  const totals = summary?.totals?.[0] || {
    count: 0,
    missingPortalRef: 0,
    unresolvedPortalRef: 0,
    blankPortalName: 0,
  };

  console.log(`\n${collectionConfig.label}`);
  console.log("=".repeat(collectionConfig.label.length));
  console.log(`Total problem records: ${totals.count}`);
  console.log(`Missing portal ref: ${totals.missingPortalRef}`);
  console.log(`Portal ref not found in portals: ${totals.unresolvedPortalRef}`);
  console.log(`Portal with blank companyName: ${totals.blankPortalName}`);

  console.log("\nProblem portal refs:");
  if (!summary?.byPortalRef?.length) {
    console.log("  none");
  } else {
    summary.byPortalRef.forEach((row: any) => {
      const portalRef = row._id ? String(row._id) : "(missing/null)";
      const sampleRefIds = (row.sampleRefIds || [])
        .filter((value: unknown) => value != null)
        .slice(0, 10)
        .join(", ");
      console.log(
        `  ${portalRef} | count=${row.count} | latestCreatedAt=${formatDate(
          row.latestCreatedAt,
        )} | sampleRefIds=${sampleRefIds || "n/a"}`,
      );
    });
  }

  console.log("\nSample records:");
  if (!summary?.samples?.length) {
    console.log("  none");
  } else {
    summary.samples.forEach((sample: any) => {
      console.log(`  ${JSON.stringify(sample)}`);
    });
  }
};

const run = async () => {
  const options = parseArgs();

  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    await scanCollection(
      {
        label: "Orders with invalid portalId",
        collectionName: "orders",
        portalField: "portalId",
        sampleFields: {
          _id: 1,
          refId: 1,
          createdAt: 1,
          bookedAt: 1,
          status: 1,
          "customer.name": 1,
          "customer.email": 1,
        },
      },
      options,
    );

    await scanCollection(
      {
        label: "Quotes with invalid portal",
        collectionName: "quotes",
        portalField: "portal",
        fallbackPortalField: "portalId",
        sampleFields: {
          _id: 1,
          refId: 1,
          createdAt: 1,
          status: 1,
          "customer.name": 1,
          "customer.email": 1,
        },
      },
      options,
    );
  } catch (error) {
    logger.error("Failed to scan orphaned portal records", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run().then(() => {
  process.exit(process.exitCode || 0);
});
