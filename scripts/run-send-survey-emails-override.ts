#!/usr/bin/env tsx
/**
 * Send Survey Emails to Override (Preview)
 *
 * Sends both survey emails to NOTIFICATION_OVERRIDE_EMAIL so you can preview them:
 * 1. Standard survey — "We're Listening. How did we do?" (survey.hbs)
 * 2. MMI pre-survey — "McCollister's Values your Opinion" (mmi-pre-survey-notification.hbs)
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-send-survey-emails-override.ts --refId 301182
 *   tsx -r dotenv/config scripts/run-send-survey-emails-override.ts
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { Order } from "../src/_global/models";
import { sendSurvey } from "../src/order/notifications/sendSurvey";
import { sendPreSurveyNotificationMmi } from "../src/order/notifications/sendPreSurveyNotificationMmi";
import { logger } from "../src/core/logger";

async function sendSurveyEmailsOverride(refId?: string) {
  try {
    const overrideEmail = process.env.NOTIFICATION_OVERRIDE_EMAIL?.trim();
    if (!overrideEmail) {
      console.error(
        "Error: NOTIFICATION_OVERRIDE_EMAIL is required to send the override emails.",
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
      order = await Order.findOne({ refId: { $in: refIdQuery } });
      if (!order) {
        console.error(`Error: Order with refId ${refId} not found`);
        process.exit(1);
      }
    } else {
      order = await Order.findOne({
        "customer.email": { $exists: true, $ne: null, $ne: "" },
      })
        .sort({ createdAt: -1 })
        .lean();
      if (!order) {
        console.error("Error: No orders found. Pass --refId to use a specific order.");
        process.exit(1);
      }
    }

    const orderId = String(order._id);
    console.log("\n📧 Sending survey emails to override (preview)");
    console.log("=".repeat(80));
    console.log(`Order ID: ${orderId}`);
    console.log(`Ref ID: ${(order as any).refId}`);
    console.log(`Override Recipient: ${overrideEmail}\n`);

    const override = {
      recipientEmail: overrideEmail,
      recipientName: "Test Recipient",
    };

    console.log("1. Standard survey — \"We're Listening. How did we do?\"");
    const surveyResult = await sendSurvey({
      orderId,
      ...override,
    });
    if (surveyResult.success) {
      console.log("   ✅ Sent");
    } else {
      console.error("   ❌ Failed:", surveyResult.error || "Unknown error");
    }

    console.log("\n2. MMI pre-survey — \"McCollister's Values your Opinion\"");
    const mmiResult = await sendPreSurveyNotificationMmi({
      orderId,
      ...override,
    });
    if (mmiResult.success) {
      console.log("   ✅ Sent");
    } else {
      console.error("   ❌ Failed:", mmiResult.error || "Unknown error");
    }

    console.log("\nDone. Check your inbox at", overrideEmail);
  } catch (error) {
    logger.error("Error sending survey override emails:", error);
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
Usage: tsx -r dotenv/config scripts/run-send-survey-emails-override.ts [options]

Sends both survey emails to NOTIFICATION_OVERRIDE_EMAIL for preview.

Options:
  --refId <refId>     Optional. Order refId to use for template data.
  --ref-id <refId>    Alternative flag for refId.

If --refId is omitted, the most recent order with a customer email is used.

Notes:
  - Requires NOTIFICATION_OVERRIDE_EMAIL to be set.

Example:
  tsx -r dotenv/config scripts/run-send-survey-emails-override.ts --refId 301182
`);
    process.exit(0);
  }
}

sendSurveyEmailsOverride(refId);
