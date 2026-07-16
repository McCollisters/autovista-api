#!/usr/bin/env tsx
/**
 * Generate and EMAIL the monthly portal report for a given month.
 *
 * Usage:
 *   tsx scripts/run-send-portal-monthly-report.ts "YYYY-MM" ["<portalId|companyName>"] [recipient1,recipient2]
 *
 * Defaults to the portal/recipients configured in sendPortalMonthlyReport.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import { config } from "../src/config/environment";
import { logger } from "../src/core/logger";
import { sendPortalMonthlyReport } from "../src/order/tasks/sendPortalMonthlyReport";

const run = async () => {
  const [monthArg, portalArg, recipientsArg] = process.argv.slice(2);

  if (!monthArg) {
    console.error(
      'Usage: tsx scripts/run-send-portal-monthly-report.ts "YYYY-MM" ["<portalId|companyName>"] [recipient1,recipient2]',
    );
    process.exit(1);
  }

  const month = DateTime.fromFormat(monthArg, "yyyy-MM", { zone: "utc" });
  if (!month.isValid) {
    console.error("Month must be in YYYY-MM format.");
    process.exit(1);
  }

  const recipients = recipientsArg
    ? recipientsArg.split(",").map((email) => email.trim()).filter(Boolean)
    : undefined;

  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    await sendPortalMonthlyReport({
      month,
      portalIdOrName: portalArg || undefined,
      recipients,
    });
  } catch (error) {
    logger.error("Portal monthly report run failed", {
      month: monthArg,
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
