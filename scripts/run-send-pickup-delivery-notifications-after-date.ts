#!/usr/bin/env tsx
/**
 * Send pickup/delivery notifications for orders with scheduled dates
 * on/after the provided cutoff. Flags are preserved.
 *
 * Required env:
 * - NOTIFICATION_OVERRIDE_EMAIL
 * - NOTIFICATION_SCHEDULE_CUTOFF_DATE (ISO string)
 */

import "dotenv/config";
import mongoose from "mongoose";
import { Order } from "@/_global/models";
import { config } from "../src/config/environment";
import { logger } from "../src/core/logger";
import {
  sendDeliveryNotificationsForOrder,
  sendPickupNotificationsForOrder,
} from "../src/order/tasks/sendPickupDeliveryNotifications";

const parseCutoff = (value?: string) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const buildPickupQuery = (cutoff: Date) => ({
  "notifications.awaitingPickupConfirmation": true,
  $or: [
    { "schedule.pickupEstimated.0": { $gte: cutoff } },
    { "schedule.pickupEstimated.1": { $gte: cutoff } },
    { "schedule.pickupSelected": { $gte: cutoff } },
  ],
});

const buildDeliveryQuery = (cutoff: Date) => ({
  "notifications.awaitingDeliveryConfirmation": true,
  $or: [
    { "schedule.deliveryEstimated.0": { $gte: cutoff } },
    { "schedule.deliveryEstimated.1": { $gte: cutoff } },
  ],
});

const run = async () => {
  const overrideEmail = process.env.NOTIFICATION_OVERRIDE_EMAIL;
  if (!overrideEmail) {
    logger.error(
      "NOTIFICATION_OVERRIDE_EMAIL is required for this script. Aborting.",
    );
    process.exit(1);
  }

  const cutoff = parseCutoff(process.env.NOTIFICATION_SCHEDULE_CUTOFF_DATE);
  if (!cutoff) {
    logger.error(
      "NOTIFICATION_SCHEDULE_CUTOFF_DATE is required (ISO string). Aborting.",
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    logger.info("Notification run options", {
      preserveFlags: true,
      cutoffDate: cutoff.toISOString(),
      overrideEmail,
    });

    const pickupOrders = await Order.find(buildPickupQuery(cutoff));
    logger.info("Pickup notification candidates", {
      count: pickupOrders.length,
      cutoffDate: cutoff.toISOString(),
    });

    for (const order of pickupOrders) {
      try {
        await sendPickupNotificationsForOrder(order, true);
      } catch (error) {
        logger.error("Pickup notification failed for order", {
          orderId: order._id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const deliveryOrders = await Order.find(buildDeliveryQuery(cutoff));
    logger.info("Delivery notification candidates", {
      count: deliveryOrders.length,
      cutoffDate: cutoff.toISOString(),
    });

    for (const order of deliveryOrders) {
      try {
        await sendDeliveryNotificationsForOrder(order, true);
      } catch (error) {
        logger.error("Delivery notification failed for order", {
          orderId: order._id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("Notification run completed (flags preserved)", {
      overrideEmail,
    });
  } catch (error) {
    logger.error("Notification run failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
