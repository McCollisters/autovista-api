#!/usr/bin/env tsx
/**
 * Add Dealerquotes@mccollisters.com pickup/delivery notifications
 * to all premium portals.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-add-dealerquotes-premium-notification.ts
 *   tsx -r dotenv/config scripts/run-add-dealerquotes-premium-notification.ts --dry-run
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { Portal } from "../src/_global/models";
import { logger } from "../src/core/logger";

interface ScriptOptions {
  dryRun?: boolean;
}

const DEALERQUOTES_EMAIL = "Dealerquotes@mccollisters.com";

async function run(options: ScriptOptions = {}) {
  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    const portals = await Portal.find({ isPremium: true }).lean();

    if (portals.length === 0) {
      console.log("No premium portals found.");
      return;
    }

    console.log(`Found ${portals.length} premium portal(s).`);

    let updatedCount = 0;
    for (const portal of portals) {
      const existing = Array.isArray(portal.notificationEmails)
        ? portal.notificationEmails
        : [];

      const alreadyExists = existing.some(
        (entry: any) =>
          (entry?.email || "").toLowerCase() === DEALERQUOTES_EMAIL.toLowerCase(),
      );

      if (alreadyExists) {
        continue;
      }

      if (options.dryRun) {
        console.log(
          `[dry-run] Would add ${DEALERQUOTES_EMAIL} to ${portal.companyName} (${portal._id})`,
        );
        continue;
      }

      const nextEmails = [
        ...existing,
        { email: DEALERQUOTES_EMAIL, pickup: true, delivery: true },
      ];

      await Portal.updateOne(
        { _id: portal._id },
        { $set: { notificationEmails: nextEmails } },
      );

      updatedCount += 1;
      console.log(
        `Updated ${portal.companyName} (${portal._id}) with ${DEALERQUOTES_EMAIL}`,
      );
    }

    if (!options.dryRun) {
      console.log(`\nUpdated ${updatedCount} portal(s).`);
    }
  } catch (error) {
    logger.error("Error updating premium portal notifications:", error);
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  }
}

const args = process.argv.slice(2);
const options: ScriptOptions = {
  dryRun: args.includes("--dry-run"),
};

run(options);
