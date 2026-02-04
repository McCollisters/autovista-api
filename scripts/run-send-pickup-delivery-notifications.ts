#!/usr/bin/env tsx
/**
 * Send pickup/delivery notifications.
 * Optional: NOTIFICATION_OVERRIDE_EMAIL to route all emails to one inbox.
 * Optional: PRESERVE_NOTIFICATION_FLAGS=false to update awaiting flags.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { logger } from "../src/core/logger";
import { sendPickupDeliveryNotifications } from "../src/order/tasks/sendPickupDeliveryNotifications";

const run = async () => {
  const overrideEmail = process.env.NOTIFICATION_OVERRIDE_EMAIL;
  const preserveFlagsEnv =
    process.env.PRESERVE_NOTIFICATION_FLAGS ?? "true";
  const preserveFlags = preserveFlagsEnv.toLowerCase() !== "false";
  if (!overrideEmail) {
    logger.warn(
      "NOTIFICATION_OVERRIDE_EMAIL not set. Emails will go to real recipients.",
    );
  }

  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    await sendPickupDeliveryNotifications({ preserveFlags });

    logger.info("Notification run completed", {
      overrideEmail: overrideEmail || null,
      preserveFlags,
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
