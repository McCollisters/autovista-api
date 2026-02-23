#!/usr/bin/env tsx
/**
 * Send Agent Order Confirmation Email (Override Recipient)
 *
 * Sends the agent order confirmation email for a given refId.
 * When NOTIFICATION_OVERRIDE_EMAIL is set, the email is sent there instead of order agents.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-send-agent-order-confirmation-override.ts --refId 301182
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { Order } from "../src/_global/models";
import { sendOrderAgentEmail } from "../src/order/notifications/sendOrderAgent";
import { logger } from "../src/core/logger";

async function sendAgentOrderEmail(refId: string) {
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

    const refIdNumber = Number(refId);
    const refIdQuery = Number.isNaN(refIdNumber)
      ? [refId]
      : [refId, refIdNumber];

    const order = await Order.findOne({ refId: { $in: refIdQuery } });
    if (!order) {
      console.error(`Error: Order with refId ${refId} not found`);
      process.exit(1);
    }

    console.log("\n📧 Sending Agent Order Confirmation (Override)");
    console.log("=".repeat(80));
    console.log(`Order ID: ${order._id}`);
    console.log(`Reference ID: ${order.refId}`);
    console.log(`Override Recipient: ${overrideEmail}`);

    const result = await sendOrderAgentEmail({
      orderId: String(order._id),
      recipientEmail: overrideEmail,
      recipientName: "Test Recipient",
    });

    if (result.success) {
      console.log("✅ Email sent successfully");
    } else {
      console.error("❌ Email failed", result.error || "Unknown error");
      process.exit(1);
    }
  } catch (error) {
    logger.error("Error sending agent order confirmation:", error);
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  }
}

const args = process.argv.slice(2);
let refId = "";

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if ((arg === "--refId" || arg === "--ref-id") && args[i + 1]) {
    refId = args[i + 1];
    i++;
  } else if (arg === "--help" || arg === "-h") {
    console.log(`
Usage: tsx -r dotenv/config scripts/run-send-agent-order-confirmation-override.ts [options]

Required Options:
  --refId <refId>     Order refId to send the email for
  --ref-id <refId>    Alternative flag for refId

Notes:
  - Requires NOTIFICATION_OVERRIDE_EMAIL to be set (email will be sent there).

Examples:
  tsx -r dotenv/config scripts/run-send-agent-order-confirmation-override.ts --refId 301182
`);
    process.exit(0);
  }
}

if (!refId) {
  console.error("Error: --refId is required");
  console.log("Use --help for usage information");
  process.exit(1);
}

sendAgentOrderEmail(refId);
