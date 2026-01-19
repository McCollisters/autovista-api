#!/usr/bin/env tsx
/**
 * Update portal defaultPaymentType based on COD portal list.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-update-portal-default-payment-type.ts
 *   tsx -r dotenv/config scripts/run-update-portal-default-payment-type.ts --dry-run
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { Portal } from "../src/_global/models";
import { logger } from "../src/core/logger";

const COD_PORTAL_IDS = new Set([
  "5f2ad881ed5a090017f91715", // Suddath Relocation
  "64ece35abfc3deb98e9d180f", // Mc Instant Quote
  "6384ea07928af40046d4d22a",
  "6717abfa768fb54a3c6823b9", // Tim Toton
  "6453ff09eafb1843de4d5cd1",
]);

const parseArgs = () => {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
  };
};

const run = async () => {
  const { dryRun } = parseArgs();

  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    const totalPortals = await Portal.countDocuments();
    const codCount = await Portal.countDocuments({
      _id: { $in: Array.from(COD_PORTAL_IDS) },
    });

    console.log(
      `Found ${totalPortals} portal(s). COD list: ${codCount} portal(s).${
        dryRun ? " (dry run)" : ""
      }`,
    );

    if (dryRun) {
      return;
    }

    await Portal.updateMany(
      {},
      { $set: { "options.orderForm.defaultPaymentType": "billing" } },
    );

    await Portal.updateMany(
      { _id: { $in: Array.from(COD_PORTAL_IDS) } },
      { $set: { "options.orderForm.defaultPaymentType": "cod" } },
    );

    logger.info("Portal defaultPaymentType update completed");
  } catch (error) {
    logger.error("Failed to update portal defaultPaymentType", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

run();
