#!/usr/bin/env tsx
/**
 * Backfill pickupEstimated ranges for "new" TMS orders.
 *
 * Usage:
 *   npx tsx -r dotenv/config scripts/backfill-pickup-estimated-range.ts
 *   npx tsx -r dotenv/config scripts/backfill-pickup-estimated-range.ts --dry-run
 *   npx tsx -r dotenv/config scripts/backfill-pickup-estimated-range.ts --limit 500
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { Order, Settings } from "../src/_global/models";
import { getDateRanges } from "../src/_global/utils/getDateRanges";
import { logger } from "../src/core/logger";

const DEFAULT_BATCH_SIZE = 500;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIndex = args.findIndex((arg) => arg === "--limit");
  const limit =
    limitIndex >= 0 && args[limitIndex + 1]
      ? Number(args[limitIndex + 1])
      : undefined;

  return { dryRun, limit };
};

const normalizeTransitTime = (value: any): [number, number] => {
  if (!Array.isArray(value) || value.length < 2) {
    return [0, 0];
  }
  const minDays = Number(value[0]);
  const maxDays = Number(value[1]);
  if (!Number.isFinite(minDays) || !Number.isFinite(maxDays)) {
    return [0, 0];
  }
  return [minDays, maxDays];
};

async function loadHolidayDates(): Promise<Date[]> {
  const settings = await Settings.findOne({});
  if (!settings?.holidays) {
    return [];
  }

  return settings.holidays
    .map((holiday: any) => {
      const rawDate = holiday?.date ?? holiday;
      const parsedDate = rawDate instanceof Date ? rawDate : new Date(rawDate);
      return parsedDate;
    })
    .filter((date: Date) => !isNaN(date.getTime()));
}

async function main() {
  const { dryRun, limit } = parseArgs();

  await mongoose.connect(config.database.uri, config.database.options);
  logger.info("Connected to MongoDB");

  const holidayDates = await loadHolidayDates();

  const query: any = {
    "tms.status": { $regex: /^new$/i },
    "schedule.pickupEstimated.0": { $exists: true },
  };

  const cursor = Order.find(query).cursor();

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let batch: any[] = [];

  for await (const order of cursor) {
    scanned++;
    if (limit && scanned > limit) {
      break;
    }

    const schedule = order.schedule || {};
    const serviceLevel = Number(schedule.serviceLevel);
    if (!Number.isFinite(serviceLevel) || serviceLevel <= 1) {
      skipped++;
      continue;
    }

    const pickupEstimated = Array.isArray(schedule.pickupEstimated)
      ? schedule.pickupEstimated
      : [];
    const hasRange = pickupEstimated.length > 1 && pickupEstimated[1];
    if (hasRange) {
      skipped++;
      continue;
    }

    const baseDate = schedule.pickupSelected || pickupEstimated[0];
    if (!baseDate) {
      skipped++;
      continue;
    }

    const transitTime = normalizeTransitTime(order.transitTime);
    const [pickupStart, pickupEnd] = getDateRanges(
      baseDate,
      serviceLevel,
      transitTime,
      holidayDates,
    );

    if (!pickupStart || !pickupEnd) {
      skipped++;
      continue;
    }

    if (!dryRun) {
      batch.push({
        updateOne: {
          filter: { _id: order._id },
          update: {
            $set: {
              "schedule.pickupEstimated": [pickupStart, pickupEnd],
            },
          },
        },
      });
    }

    updated++;

    if (!dryRun && batch.length >= DEFAULT_BATCH_SIZE) {
      await Order.bulkWrite(batch, { ordered: false });
      batch = [];
    }
  }

  if (!dryRun && batch.length > 0) {
    await Order.bulkWrite(batch, { ordered: false });
  }

  logger.info("Backfill complete", {
    dryRun,
    scanned,
    updated,
    skipped,
    limit: limit || null,
  });
}

main()
  .catch((error) => {
    logger.error("Backfill failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  });
