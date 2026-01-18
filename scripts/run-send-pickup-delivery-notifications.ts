#!/usr/bin/env tsx
/**
 * Send pickup/delivery notifications without clearing flags.
 * Requires NOTIFICATION_OVERRIDE_EMAIL to be set.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { logger } from "../src/core/logger";
import { sendPickupDeliveryNotifications } from "../src/order/tasks/sendPickupDeliveryNotifications";

const run = async () => {
  const overrideEmail = process.env.NOTIFICATION_OVERRIDE_EMAIL;

  if (!overrideEmail) {
    logger.error(
      "NOTIFICATION_OVERRIDE_EMAIL is required for this script. Aborting.",
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    await sendPickupDeliveryNotifications({ preserveFlags: true });

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
