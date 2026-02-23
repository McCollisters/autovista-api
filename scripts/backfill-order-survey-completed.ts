#!/usr/bin/env tsx
/**
 * Backfill notifications.survey.surveyCompleted = true for orders that have a survey response.
 *
 * Usage:
 *   npx tsx -r dotenv/config scripts/backfill-order-survey-completed.ts
 *   npx tsx -r dotenv/config scripts/backfill-order-survey-completed.ts --dry-run
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { Order, SurveyResponse } from "../src/_global/models";
import { logger } from "../src/core/logger";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  await mongoose.connect(config.database.uri, config.database.options);
  logger.info("Connected to MongoDB");

  const orderIds = await SurveyResponse.distinct("order", { order: { $exists: true, $ne: null } });
  const validOrderIds = orderIds.filter((id) => id != null);

  if (validOrderIds.length === 0) {
    console.log("No survey responses with order references found.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${validOrderIds.length} distinct order(s) with survey responses.`);

  if (dryRun) {
    console.log("Dry run: would set notifications.survey.surveyCompleted = true for these orders.");
    await mongoose.disconnect();
    return;
  }

  const result = await Order.updateMany(
    { _id: { $in: validOrderIds } },
    { $set: { "notifications.survey.surveyCompleted": true } },
  );

  console.log(`Updated ${result.modifiedCount} order(s) with surveyCompleted: true.`);
  if (result.matchedCount !== validOrderIds.length) {
    console.log(`Matched ${result.matchedCount} of ${validOrderIds.length} (some orders may have been deleted).`);
  }

  await mongoose.disconnect();
  logger.info("Disconnected from MongoDB");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
