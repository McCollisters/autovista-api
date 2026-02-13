#!/usr/bin/env tsx
/**
 * Send Agents Order Confirmation with Pricing (Override Recipient)
 *
 * Sends the order confirmation with pricing (MMI-style template) to NOTIFICATION_OVERRIDE_EMAIL.
 * Finds an MMI portal order (by optional refId, or any recent MMI order).
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-send-mmi-order-notification-override.ts
 *   tsx -r dotenv/config scripts/run-send-mmi-order-notification-override.ts --refId 301182
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { Order } from "../src/_global/models";
import { sendMMIOrderNotification } from "../src/order/notifications/sendMMIOrderNotification";
import { logger } from "../src/core/logger";
import { MMI_PORTALS } from "../src/_global/constants/portalIds";

async function sendMMIOrderEmail(refId?: string) {
  try {
    const overrideEmail = process.env.NOTIFICATION_OVERRIDE_EMAIL?.trim();
    if (!overrideEmail) {
      console.error(
        "Error: NOTIFICATION_OVERRIDE_EMAIL is required to send the override email.",
      );
      process.exit(1);
    }

    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    let order;
    if (refId) {
      const refIdNumber = Number(refId);
      const refIdQuery = Number.isNaN(refIdNumber)
        ? [refId]
        : [refId, refIdNumber];
      order = await Order.findOne({
        refId: { $in: refIdQuery },
        portalId: { $in: MMI_PORTALS },
      });
      if (!order) {
        console.error(
          `Error: Order with refId ${refId} not found or is not an MMI portal order.`,
        );
        process.exit(1);
      }
    } else {
      order = await Order.findOne({ portalId: { $in: MMI_PORTALS } })
        .sort({ createdAt: -1 })
        .lean();
      if (!order) {
        console.error(
          "Error: No MMI portal orders found. Create an MMI order first or pass --refId for an MMI order.",
        );
        process.exit(1);
      }
    }

    console.log("\n📧 Sending Agents Order Confirmation with Pricing (Override)");
    console.log("=".repeat(80));
    console.log(`Order ID: ${order._id}`);
    console.log(`Reference ID: ${order.refId}`);
    console.log(`Override Recipient: ${overrideEmail}`);

    const result = await sendMMIOrderNotification({
      order: order as any,
      recipientEmail: overrideEmail,
    });

    if (result.success) {
      console.log("✅ Email sent successfully");
    } else {
      console.error("❌ Email failed", result.error || "Unknown error");
      process.exit(1);
    }
  } catch (error) {
    logger.error("Error sending agents order confirmation with pricing:", error);
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  }
}

const args = process.argv.slice(2);
let refId: string | undefined;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if ((arg === "--refId" || arg === "--ref-id") && args[i + 1]) {
    refId = args[i + 1];
    i++;
  } else if (arg === "--help" || arg === "-h") {
    console.log(`
Usage: tsx -r dotenv/config scripts/run-send-mmi-order-notification-override.ts [options]

Options:
  --refId <refId>     Optional. MMI order refId (must be an MMI portal order).
  --ref-id <refId>    Alternative flag for refId.

If --refId is omitted, the most recent MMI portal order is used.

Notes:
  - Requires NOTIFICATION_OVERRIDE_EMAIL to be set.

Examples:
  tsx -r dotenv/config scripts/run-send-mmi-order-notification-override.ts
  tsx -r dotenv/config scripts/run-send-mmi-order-notification-override.ts --refId 301182
`);
    process.exit(0);
  }
}

sendMMIOrderEmail(refId);
