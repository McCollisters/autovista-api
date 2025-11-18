#!/usr/bin/env tsx
/**
 * Get Carriers Script
 *
 * Retrieves all carriers from the database and displays them.
 * Can be filtered by status, guid, or name.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-get-carriers.ts
 *   tsx -r dotenv/config scripts/run-get-carriers.ts --status active
 *   tsx -r dotenv/config scripts/run-get-carriers.ts --guid <guid>
 *   tsx -r dotenv/config scripts/run-get-carriers.ts --name <name>
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { Carrier } from "../src/_global/models";
import { logger } from "../src/core/logger";

interface ScriptOptions {
  status?: string;
  guid?: string;
  name?: string;
  format?: "json" | "table";
}

async function getCarriers(options: ScriptOptions = {}) {
  try {
    // Connect to database
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    // Build query
    const query: any = {};
    if (options.status) {
      query.status = options.status;
    }
    if (options.guid) {
      query.guid = options.guid;
    }
    if (options.name) {
      query.name = { $regex: options.name, $options: "i" };
    }

    // Fetch carriers
    const carriers = await Carrier.find(query).lean();

    if (carriers.length === 0) {
      console.log("No carriers found matching the criteria.");
      return;
    }

    // Display results
    if (options.format === "json") {
      console.log(JSON.stringify(carriers, null, 2));
    } else {
      console.log(`\nFound ${carriers.length} carrier(s):\n`);
      console.log("=".repeat(80));

      carriers.forEach((carrier, index) => {
        console.log(`\n${index + 1}. ${carrier.name || "Unknown"}`);
        console.log(`   GUID: ${carrier.guid || "N/A"}`);
        console.log(`   Email: ${carrier.email || "N/A"}`);
        console.log(`   Status: ${carrier.status || "N/A"}`);
        console.log(`   Activities: ${carrier.activity?.length || 0}`);
        if (carrier.activity && carrier.activity.length > 0) {
          console.log(
            `   Last Activity: ${carrier.activity[carrier.activity.length - 1]?.type || "N/A"} on ${carrier.activity[carrier.activity.length - 1]?.date || "N/A"}`,
          );
        }
      });

      console.log("\n" + "=".repeat(80));
    }

    logger.info(`Retrieved ${carriers.length} carrier(s)`);
  } catch (error) {
    logger.error("Error retrieving carriers:", error);
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: ScriptOptions = {
  format: "table",
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--status" && args[i + 1]) {
    options.status = args[i + 1];
    i++;
  } else if (arg === "--guid" && args[i + 1]) {
    options.guid = args[i + 1];
    i++;
  } else if (arg === "--name" && args[i + 1]) {
    options.name = args[i + 1];
    i++;
  } else if (arg === "--format" && args[i + 1]) {
    options.format = args[i + 1] as "json" | "table";
    i++;
  } else if (arg === "--help" || arg === "-h") {
    console.log(`
Usage: tsx -r dotenv/config scripts/run-get-carriers.ts [options]

Options:
  --status <status>    Filter by carrier status (e.g., active, inactive)
  --guid <guid>        Filter by carrier GUID
  --name <name>        Filter by carrier name (case-insensitive partial match)
  --format <format>    Output format: json or table (default: table)
  --help, -h           Show this help message

Examples:
  tsx -r dotenv/config scripts/run-get-carriers.ts
  tsx -r dotenv/config scripts/run-get-carriers.ts --status active
  tsx -r dotenv/config scripts/run-get-carriers.ts --guid abc123
  tsx -r dotenv/config scripts/run-get-carriers.ts --name "ABC Transport"
  tsx -r dotenv/config scripts/run-get-carriers.ts --format json
`);
    process.exit(0);
  }
}

// Run the script
getCarriers(options);
