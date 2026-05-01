#!/usr/bin/env tsx
/**
 * Set awaiting pickup/delivery confirmation flags to false when the
 * corresponding schedule event is more than 24 hours in the past.
 *
 * Event timestamps match sendPickupDeliveryNotifications:
 * - Pickup: pickupCompleted, else pickupEstimated[0], else pickupSelected
 * - Delivery: deliveryCompleted, else deliveryEstimated[0]
 *
 * If a flag is true but no usable event date exists, that flag is not changed.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-clear-stale-awaiting-pickup-delivery-flags.ts
 *   tsx -r dotenv/config scripts/run-clear-stale-awaiting-pickup-delivery-flags.ts --dry-run
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { logger } from "../src/core/logger";
import { Order } from "../src/_global/models";

const MS_24H = 24 * 60 * 60 * 1000;
const BULK_BATCH = 250;

type OrderScheduleSlice = {
  schedule?: {
    pickupCompleted?: Date | string | null;
    pickupEstimated?: (Date | string | null)[];
    pickupSelected?: Date | string | null;
    deliveryCompleted?: Date | string | null;
    deliveryEstimated?: (Date | string | null)[];
  };
};

const getPickupEventDate = (order: OrderScheduleSlice): Date | null => {
  const raw =
    order?.schedule?.pickupCompleted ??
    order?.schedule?.pickupEstimated?.[0] ??
    order?.schedule?.pickupSelected ??
    null;
  if (!raw) {
    return null;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getDeliveryEventDate = (order: OrderScheduleSlice): Date | null => {
  const raw =
    order?.schedule?.deliveryCompleted ??
    order?.schedule?.deliveryEstimated?.[0] ??
    null;
  if (!raw) {
    return null;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const eventIsOlderThan24h = (event: Date, nowMs: number) =>
  event.getTime() < nowMs - MS_24H;

async function run(dryRun: boolean) {
  const nowMs = Date.now();

  let scanned = 0;
  let ordersUpdated = 0;
  let pickupFlagsCleared = 0;
  let deliveryFlagsCleared = 0;
  const bulkOps: Array<{
    updateOne: {
      filter: { _id: mongoose.Types.ObjectId };
      update: { $set: Record<string, boolean> };
    };
  }> = [];

  const flushBulk = async () => {
    if (dryRun || bulkOps.length === 0) {
      bulkOps.length = 0;
      return;
    }
    const result = await Order.bulkWrite(bulkOps, { ordered: false });
    logger.info("Bulk write batch", {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
    bulkOps.length = 0;
  };

  const cursor = Order.find({
    $or: [
      { "notifications.awaitingPickupConfirmation": true },
      { "notifications.awaitingDeliveryConfirmation": true },
    ],
  })
    .select({ _id: 1, notifications: 1, schedule: 1 })
    .lean()
    .cursor();

  for await (const order of cursor) {
    scanned += 1;
    const doc = order as OrderScheduleSlice & {
      _id: mongoose.Types.ObjectId;
      notifications?: {
        awaitingPickupConfirmation?: boolean;
        awaitingDeliveryConfirmation?: boolean;
      };
    };

    const $set: Record<string, boolean> = {};

    if (doc.notifications?.awaitingPickupConfirmation) {
      const pickupAt = getPickupEventDate(doc);
      if (pickupAt && eventIsOlderThan24h(pickupAt, nowMs)) {
        $set["notifications.awaitingPickupConfirmation"] = false;
        pickupFlagsCleared += 1;
      }
    }

    if (doc.notifications?.awaitingDeliveryConfirmation) {
      const deliveryAt = getDeliveryEventDate(doc);
      if (deliveryAt && eventIsOlderThan24h(deliveryAt, nowMs)) {
        $set["notifications.awaitingDeliveryConfirmation"] = false;
        deliveryFlagsCleared += 1;
      }
    }

    if (Object.keys($set).length === 0) {
      continue;
    }

    ordersUpdated += 1;

    if (!dryRun) {
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set },
        },
      });
      if (bulkOps.length >= BULK_BATCH) {
        await flushBulk();
      }
    }
  }

  await flushBulk();

  logger.info("Clear stale awaiting pickup/delivery flags — complete", {
    dryRun,
    scanned,
    ordersUpdated,
    pickupFlagsCleared,
    deliveryFlagsCleared,
    thresholdMeaning: "event strictly before this instant are cleared",
    threshold: new Date(nowMs - MS_24H).toISOString(),
  });
}

const dryRun = process.argv.includes("--dry-run");

try {
  await mongoose.connect(config.database.uri, config.database.options);
  logger.info("Connected to MongoDB");
  await run(dryRun);
} catch (error) {
  logger.error("Script failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
  logger.info("Disconnected from MongoDB");
}
