#!/usr/bin/env tsx
/**
 * Set Ferrari portals to premium.
 *
 * Finds portals with companyName including "ferrari" (case-insensitive)
 * and sets isPremium to true.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-set-premium-ferrari-portals.ts
 *   tsx -r dotenv/config scripts/run-set-premium-ferrari-portals.ts --dry-run
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { Portal } from "../src/_global/models";
import { logger } from "../src/core/logger";

interface ScriptOptions {
  dryRun?: boolean;
}

async function setFerrariPremium(options: ScriptOptions = {}) {
  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    const query = { companyName: { $regex: "ferrari", $options: "i" } };
    const portals = await Portal.find(query).lean();

    if (portals.length === 0) {
      console.log("No portals found matching 'ferrari'.");
      return;
    }

    console.log(`Found ${portals.length} portal(s):`);
    portals.forEach((portal: any, index: number) => {
      console.log(
        `${index + 1}. ${portal.companyName} (${portal._id}) - isPremium: ${
          portal.isPremium ? "true" : "false"
        }`,
      );
    });

    if (options.dryRun) {
      console.log("\nDry run enabled. No updates were made.");
      return;
    }

    const result = await Portal.updateMany(query, { $set: { isPremium: true } });
    console.log(
      `\nUpdated ${result.modifiedCount || 0} portal(s) to isPremium=true.`,
    );
    logger.info("Ferrari portals updated", {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (error) {
    logger.error("Error updating Ferrari portals:", error);
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  }
}

const args = process.argv.slice(2);
const options: ScriptOptions = {};

if (args.includes("--dry-run")) {
  options.dryRun = true;
}

setFerrariPremium(options);
