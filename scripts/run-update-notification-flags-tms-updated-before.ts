#!/usr/bin/env tsx
/**
 * Flip awaiting pickup/delivery confirmation flags to false
 * for orders that match the specified criteria.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-update-notification-flags-tms-updated-before.ts
 *   tsx -r dotenv/config scripts/run-update-notification-flags-tms-updated-before.ts --dry-run
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { logger } from "../src/core/logger";
import { Order } from "../src/_global/models";

const TARGET_UPDATED_BEFORE_PICKUP = new Date(2026, 1, 28, 5, 2, 5);
const TARGET_UPDATED_BEFORE_DELIVERY = new Date("2026-01-28T05:08:04Z");

const buildQuery = () => ({
  $or: [
    {
      "notifications.awaitingPickupConfirmation": true,
      "tms.updatedAt": { $lt: TARGET_UPDATED_BEFORE_PICKUP },
    },
    {
      "notifications.awaitingDeliveryConfirmation": true,
      "tms.updatedAt": { $lt: TARGET_UPDATED_BEFORE_DELIVERY },
    },
  ],
});

async function run(dryRun = false) {
  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    const query = buildQuery();
    const matchCount = await Order.countDocuments(query);

    logger.info("Matched orders", {
      count: matchCount,
      pickupUpdatedBefore: TARGET_UPDATED_BEFORE_PICKUP.toISOString(),
      deliveryUpdatedBefore: TARGET_UPDATED_BEFORE_DELIVERY.toISOString(),
      dryRun,
    });

    if (dryRun || matchCount === 0) {
      return;
    }

    const result = await Order.updateMany(query, {
      $set: {
        "notifications.awaitingPickupConfirmation": false,
        "notifications.awaitingDeliveryConfirmation": false,
      },
    });

    logger.info("Updated orders", {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (error) {
    logger.error("Error updating notification flags", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  }
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

run(dryRun);
