#!/usr/bin/env tsx
/**
 * Find orders from the last N days whose delivery estimate is a single date
 * (missing end, or start/end on the same calendar day) and expand them to a
 * transit-time range: [start, start + (maxDays - minDays)].
 *
 * Defaults to dry-run so you can review proposed ranges before writing.
 *
 * Usage:
 *   npx tsx -r dotenv/config scripts/backfill-single-delivery-estimated-range.ts
 *   npx tsx -r dotenv/config scripts/backfill-single-delivery-estimated-range.ts --dry-run
 *   npx tsx -r dotenv/config scripts/backfill-single-delivery-estimated-range.ts --apply
 *   npx tsx -r dotenv/config scripts/backfill-single-delivery-estimated-range.ts --days 90 --limit 50
 */

import "dotenv/config";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import { config } from "../src/config/environment";
import { Order } from "../src/_global/models";
import {
  expandSingleDeliveryDateToRange,
  isSameCalendarDay,
} from "../src/order/integrations/updateOrderFromSD";
import { logger } from "../src/core/logger";

const DEFAULT_DAYS = 90;
const DEFAULT_BATCH_SIZE = 250;
const SCHEDULE_TIMEZONE = "America/New_York";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  // Dry-run unless explicitly applying
  const dryRun = !apply || args.includes("--dry-run");

  const daysIndex = args.findIndex((arg) => arg === "--days");
  const days =
    daysIndex >= 0 && args[daysIndex + 1]
      ? Number(args[daysIndex + 1])
      : DEFAULT_DAYS;

  const limitIndex = args.findIndex((arg) => arg === "--limit");
  const limit =
    limitIndex >= 0 && args[limitIndex + 1]
      ? Number(args[limitIndex + 1])
      : undefined;

  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`Invalid --days value: ${args[daysIndex + 1]}`);
  }
  if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
    throw new Error(`Invalid --limit value: ${args[limitIndex + 1]}`);
  }

  return { dryRun, days, limit };
};

const toNyDateString = (value: Date | string | null | undefined): string => {
  if (!value) return "(none)";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "(invalid)";
  return (
    DateTime.fromJSDate(d).setZone(SCHEDULE_TIMEZONE).toISODate() ?? "(invalid)"
  );
};

const toValidDate = (value: unknown): Date | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * True when deliveryEstimated is missing an end date, or start/end are the
 * same calendar day in America/New_York.
 */
const isSingleDeliveryEstimated = (
  deliveryEstimated: unknown,
): { isSingle: boolean; start: Date | null } => {
  if (!Array.isArray(deliveryEstimated) || deliveryEstimated.length === 0) {
    return { isSingle: false, start: null };
  }

  const start = toValidDate(deliveryEstimated[0]);
  if (!start) {
    return { isSingle: false, start: null };
  }

  const end = toValidDate(deliveryEstimated[1]);
  if (!end) {
    return { isSingle: true, start };
  }

  if (isSameCalendarDay(start, end)) {
    return { isSingle: true, start };
  }

  return { isSingle: false, start };
};

async function main() {
  const { dryRun, days, limit } = parseArgs();
  const since = DateTime.now()
    .setZone(SCHEDULE_TIMEZONE)
    .minus({ days })
    .startOf("day")
    .toJSDate();

  await mongoose.connect(config.database.uri, config.database.options);
  logger.info("Connected to MongoDB", {
    dryRun,
    days,
    since: since.toISOString(),
    limit: limit ?? null,
  });

  if (dryRun) {
    console.log(
      "\nDRY RUN — no writes. Pass --apply to update orders.\n" +
        `Looking at orders created since ${toNyDateString(since)} (${days} days).\n`,
    );
  } else {
    console.log(
      `\nAPPLY MODE — writing deliveryEstimated ranges for orders since ${toNyDateString(since)}.\n`,
    );
  }

  const query = {
    createdAt: { $gte: since },
    "schedule.deliveryEstimated.0": { $exists: true, $ne: null },
  };

  const cursor = Order.find(query)
    .select({
      refId: 1,
      reg: 1,
      status: 1,
      transitTime: 1,
      createdAt: 1,
      "schedule.deliveryEstimated": 1,
      "tms.status": 1,
    })
    .sort({ createdAt: -1 })
    .cursor();

  let scanned = 0;
  let matched = 0;
  let updated = 0;
  let skipped = 0;
  let missingTransit = 0;
  const batch: Array<{
    updateOne: {
      filter: { _id: mongoose.Types.ObjectId };
      update: { $set: { "schedule.deliveryEstimated": [Date, Date] } };
    };
  }> = [];

  console.log(
    [
      "refId".padEnd(10),
      "status".padEnd(12),
      "transit".padEnd(10),
      "current".padEnd(24),
      "proposed".padEnd(24),
    ].join("  "),
  );
  console.log("-".repeat(90));

  for await (const order of cursor) {
    scanned++;
    if (limit && matched >= limit) {
      break;
    }

    const deliveryEstimated = order.schedule?.deliveryEstimated;
    const { isSingle, start } = isSingleDeliveryEstimated(deliveryEstimated);
    if (!isSingle || !start) {
      skipped++;
      continue;
    }

    matched++;

    const transitTime = Array.isArray(order.transitTime)
      ? (order.transitTime as number[])
      : null;
    if (!transitTime || transitTime.length < 2) {
      missingTransit++;
    }

    const [proposedStart, proposedEnd] = expandSingleDeliveryDateToRange(
      start,
      transitTime,
      Array.isArray(deliveryEstimated)
        ? (deliveryEstimated as Date[])
        : undefined,
    );

    const currentEnd = toValidDate(
      Array.isArray(deliveryEstimated) ? deliveryEstimated[1] : null,
    );
    const currentLabel = currentEnd
      ? `${toNyDateString(start)} → ${toNyDateString(currentEnd)}`
      : `${toNyDateString(start)} (single)`;
    const proposedLabel = `${toNyDateString(proposedStart)} → ${toNyDateString(proposedEnd)}`;
    const transitLabel = transitTime
      ? `[${transitTime[0]}, ${transitTime[1]}]`
      : "(none)";

    console.log(
      [
        String(order.refId ?? "").padEnd(10),
        String(order.status ?? "").padEnd(12),
        transitLabel.padEnd(10),
        currentLabel.padEnd(24),
        proposedLabel.padEnd(24),
      ].join("  "),
    );

    if (!dryRun) {
      batch.push({
        updateOne: {
          filter: { _id: order._id as mongoose.Types.ObjectId },
          update: {
            $set: {
              "schedule.deliveryEstimated": [proposedStart, proposedEnd],
            },
          },
        },
      });
      updated++;

      if (batch.length >= DEFAULT_BATCH_SIZE) {
        await Order.bulkWrite(batch, { ordered: false });
        batch.length = 0;
      }
    }
  }

  if (!dryRun && batch.length > 0) {
    await Order.bulkWrite(batch, { ordered: false });
  }

  console.log("-".repeat(90));
  console.log(
    JSON.stringify(
      {
        dryRun,
        days,
        since: since.toISOString(),
        scanned,
        matched,
        updated: dryRun ? 0 : updated,
        skipped,
        missingTransit,
        limit: limit ?? null,
      },
      null,
      2,
    ),
  );

  logger.info("Backfill complete", {
    dryRun,
    days,
    scanned,
    matched,
    updated: dryRun ? 0 : updated,
    skipped,
    missingTransit,
    limit: limit ?? null,
  });
}

main()
  .catch((error) => {
    logger.error("Backfill failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  });
