#!/usr/bin/env tsx
/**
 * Migrate custom rates for Ferrari portals from source DB to destination DB.
 *
 * Reads portals with companyName containing "ferrari" from source DB,
 * maps their customRates (object or array) into the destination array format,
 * and updates matching portals in the destination DB by companyName.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-migrate-ferrari-custom-rates.ts
 *   tsx -r dotenv/config scripts/run-migrate-ferrari-custom-rates.ts --dry-run
 */

import "dotenv/config";
import mongoose, { Connection } from "mongoose";

type CustomRateArrayItem = {
  label: string;
  min: number;
  max: number;
  value: number;
};

type PortalDoc = {
  _id: string;
  companyName?: string;
  customRates?: any;
};

const RANGE_LABELS: Array<{
  key: string;
  label: string;
  min: number;
  max: number;
}> = [
  { key: "1-250", label: "1-250 miles", min: 1, max: 250 },
  { key: "251-500", label: "251-500 miles", min: 251, max: 500 },
  { key: "501-750", label: "501-750 miles", min: 501, max: 750 },
  { key: "751-1000", label: "751-1000 miles", min: 751, max: 1000 },
  { key: "1001-1250", label: "1001-1250 miles", min: 1001, max: 1250 },
  { key: "1251-1500", label: "1251-1500 miles", min: 1251, max: 1500 },
  { key: "1501-1750", label: "1501-1750 miles", min: 1501, max: 1750 },
  { key: "1751-2000", label: "1751-2000 miles", min: 1751, max: 2000 },
  { key: "2001-2500", label: "2001-2500 miles", min: 2001, max: 2500 },
  { key: "2501-3000", label: "2501-3000 miles", min: 2501, max: 3000 },
  { key: "3001-3500", label: "3001-3500 miles", min: 3001, max: 3500 },
  { key: "3501", label: "3501+ miles", min: 3501, max: 100000 },
];

const SURCHARGE_LABELS: Array<{ label: string; field: string }> = [
  { label: "SUV Class Surcharge", field: "suvClassSurcharge" },
  { label: "Van Class Surcharge", field: "vanClassSurcharge" },
  { label: "Pickup 4-Door Class Surcharge", field: "pickUp4DoorClassSurcharge" },
];

const portalSchema = new mongoose.Schema(
  {
    companyName: String,
    customRates: mongoose.Schema.Types.Mixed,
  },
  { collection: "portals" },
);

function mapCustomRatesToArray(customRates: any): CustomRateArrayItem[] {
  if (Array.isArray(customRates)) {
    return customRates;
  }

  const rates: CustomRateArrayItem[] = [];
  const mileage = customRates?.mileage || {};

  RANGE_LABELS.forEach(({ key, label, min, max }) => {
    if (mileage[key] !== undefined && mileage[key] !== null) {
      rates.push({
        label,
        min,
        max,
        value: Number(mileage[key]),
      });
    }
  });

  SURCHARGE_LABELS.forEach(({ label, field }) => {
    if (customRates?.[field] !== undefined && customRates?.[field] !== null) {
      rates.push({
        label,
        min: 0,
        max: 0,
        value: Number(customRates[field]),
      });
    }
  });

  return rates;
}

async function withConnection<T>(
  uri: string,
  label: string,
  handler: (conn: Connection) => Promise<T>,
) {
  const conn = await mongoose.createConnection(uri).asPromise();
  try {
    return await handler(conn);
  } finally {
    await conn.close();
  }
}

async function run() {
  const sourceUri = process.env.MIGRATION_SOURCE_URI;
  const destUri = process.env.MIGRATION_DEST_URI;
  const isDryRun = process.argv.includes("--dry-run");

  if (!sourceUri || !destUri) {
    throw new Error("Missing MIGRATION_SOURCE_URI or MIGRATION_DEST_URI");
  }

  const sourcePortals = await withConnection(sourceUri, "source", async (conn) => {
    const SourcePortal = conn.model<PortalDoc>("Portal", portalSchema);
    return SourcePortal.find({
      companyName: { $regex: "ferrari", $options: "i" },
    }).lean();
  });

  if (sourcePortals.length === 0) {
    console.log("No source portals found matching 'ferrari'.");
    return;
  }

  console.log(`Found ${sourcePortals.length} source portal(s).`);

  await withConnection(destUri, "dest", async (conn) => {
    const DestPortal = conn.model<PortalDoc>("Portal", portalSchema);

    for (const portal of sourcePortals) {
      const mappedRates = mapCustomRatesToArray(portal.customRates);
      if (mappedRates.length === 0) {
        console.log(
          `Skipping ${portal.companyName || portal._id} (no custom rates)`,
        );
        continue;
      }

      if (isDryRun) {
        console.log(
          `[dry-run] Would update ${portal.companyName || portal._id} with ${
            mappedRates.length
          } rate(s)`,
        );
        continue;
      }

      const result = await DestPortal.updateOne(
        { companyName: portal.companyName },
        { $set: { customRates: mappedRates } },
      );

      console.log(
        `Updated ${portal.companyName || portal._id}: matched=${
          result.matchedCount
        } modified=${result.modifiedCount}`,
      );
    }
  });
}

run().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
