#!/usr/bin/env tsx
/**
 * Generate a CSV report for a portal and month.
 *
 * Usage:
 *   tsx scripts/run-portal-monthly-report.ts "<portalId|companyName>" "YYYY-MM" [outputPath]
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import { config } from "../src/config/environment";
import { logger } from "../src/core/logger";
import {
  buildPortalMonthlyReport,
  getPortalMonthlyReportFilename,
} from "../src/order/reports/portalMonthlyReport";

const DEFAULT_OUTPUT_DIR = "reports";

async function run() {
  const [portalArg, monthArg, outputArg] = process.argv.slice(2);

  if (!portalArg || !monthArg) {
    console.error(
      'Usage: tsx scripts/run-portal-monthly-report.ts "<portalId|companyName>" "YYYY-MM" [outputPath]',
    );
    process.exit(1);
  }

  const month = DateTime.fromFormat(monthArg, "yyyy-MM", { zone: "utc" });
  if (!month.isValid) {
    console.error("Month must be in YYYY-MM format.");
    process.exit(1);
  }

  await mongoose.connect(config.database.uri, config.database.options);
  logger.info("Connected to MongoDB");

  const report = await buildPortalMonthlyReport({
    portalIdOrName: portalArg,
    month,
    dateField: "createdAt",
  });

  const outputDir = outputArg
    ? path.dirname(outputArg)
    : path.join(process.cwd(), DEFAULT_OUTPUT_DIR);
  const outputPath =
    outputArg ||
    path.join(
      outputDir,
      getPortalMonthlyReportFilename(report.portal.companyName, report.monthLabel),
    );

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, report.csvString, "utf-8");

  logger.info("CSV report generated", {
    portal: report.portal.companyName,
    month: report.monthLabel,
    outputPath,
    orders: report.ordersCount,
  });

  await mongoose.disconnect();
}

run().catch(async (error) => {
  logger.error("Error generating portal report", {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
  });
  await mongoose.disconnect();
  process.exit(1);
});
