#!/usr/bin/env tsx
/**
 * Update quotes to use portal/user fields.
 *
 * - Sets quote.portal from quote.portalId if needed
 * - Sets quote.user from quote.userId if needed
 * - Removes portalId and userId fields
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-update-quotes-portal-user.ts
 *   tsx -r dotenv/config scripts/run-update-quotes-portal-user.ts --dry-run
 *   tsx -r dotenv/config scripts/run-update-quotes-portal-user.ts --limit=100
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { Quote } from "../src/_global/models";
import { logger } from "../src/core/logger";

interface ScriptOptions {
  dryRun?: boolean;
  limit?: number;
}

const parseArgs = (): ScriptOptions => {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {};

  if (args.includes("--dry-run")) {
    options.dryRun = true;
  }

  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  if (limitArg) {
    const [, value] = limitArg.split("=");
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      options.limit = parsed;
    }
  }

  return options;
};

const normalizeObjectId = (value: any) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
};

async function run(options: ScriptOptions = {}) {
  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    const totalQuotes = await Quote.countDocuments();
    const limit = options.limit && options.limit > 0 ? options.limit : totalQuotes;
    console.log(
      `Found ${totalQuotes} quote(s). Processing ${limit}${
        options.dryRun ? " (dry run)" : ""
      }.`,
    );

    const cursor = Quote.find({})
      .limit(limit)
      .select("_id portal portalId user userId")
      .lean()
      .cursor();

    let processed = 0;
    let updated = 0;
    let skipped = 0;

    const bulkOps: Array<any> = [];
    const flushBulk = async () => {
      if (bulkOps.length === 0 || options.dryRun) {
        bulkOps.length = 0;
        return;
      }
      const result = await Quote.bulkWrite(bulkOps, { ordered: false });
      updated += result.modifiedCount || 0;
      bulkOps.length = 0;
    };

    for await (const quote of cursor) {
      processed += 1;

      const portalValue = normalizeObjectId(
        (quote as any).portal ?? (quote as any).portalId,
      );
      const userValue = normalizeObjectId(
        (quote as any).user ?? (quote as any).userId,
      );

      const update: any = { $unset: { portalId: "", userId: "" } };
      if (portalValue) {
        update.$set = { ...(update.$set || {}), portal: portalValue };
      }
      if (userValue) {
        update.$set = { ...(update.$set || {}), user: userValue };
      }

      if (!portalValue && !userValue) {
        skipped += 1;
        if (!options.dryRun) {
          bulkOps.push({
            updateOne: { filter: { _id: quote._id }, update },
          });
        }
      } else {
        if (!options.dryRun) {
          bulkOps.push({
            updateOne: { filter: { _id: quote._id }, update },
          });
        }
      }

      if (bulkOps.length >= 500) {
        await flushBulk();
      }
    }

    await flushBulk();

    console.log(
      `Processed ${processed} quote(s). Updated ${updated}. Skipped ${skipped}.`,
    );
  } catch (error) {
    logger.error("Error updating quotes:", error);
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  }
}

run(parseArgs());
