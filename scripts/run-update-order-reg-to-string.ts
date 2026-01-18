#!/usr/bin/env tsx
/**
 * Normalize order reg values to strings.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-update-order-reg-to-string.ts
 *   tsx -r dotenv/config scripts/run-update-order-reg-to-string.ts --dry-run
 *   tsx -r dotenv/config scripts/run-update-order-reg-to-string.ts --limit=100
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { Order } from "../src/_global/models";
import { logger } from "../src/core/logger";

interface ScriptOptions {
  dryRun?: boolean;
  limit?: number;
}

const parseArgs = (): ScriptOptions => {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {};

  if (args.includes("--dry-run")) {
    options.dryRun = true;
  }

  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  if (limitArg) {
    const [, value] = limitArg.split("=");
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      options.limit = parsed;
    }
  }

  return options;
};

async function run(options: ScriptOptions = {}) {
  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    const query = { reg: { $ne: null } };
    const totalOrders = await Order.countDocuments(query);
    const limit = options.limit && options.limit > 0 ? options.limit : totalOrders;
    console.log(
      `Found ${totalOrders} order(s) with reg. Processing ${limit}${
        options.dryRun ? " (dry run)" : ""
      }.`,
    );

    const cursor = Order.find(query).limit(limit).select("_id reg").lean().cursor();

    let processed = 0;
    let updated = 0;
    const bulkOps: Array<any> = [];

    const flushBulk = async () => {
      if (bulkOps.length === 0 || options.dryRun) {
        bulkOps.length = 0;
        return;
      }
      const result = await Order.bulkWrite(bulkOps, { ordered: false });
      updated += result.modifiedCount || 0;
      bulkOps.length = 0;
    };

    for await (const order of cursor) {
      processed += 1;
      const reg = (order as any).reg;
      if (typeof reg === "string") {
        continue;
      }
      const normalized = reg == null ? null : String(reg);
      if (!options.dryRun) {
        bulkOps.push({
          updateOne: {
            filter: { _id: order._id },
            update: { $set: { reg: normalized } },
          },
        });
      }

      if (bulkOps.length >= 500) {
        await flushBulk();
      }
    }

    await flushBulk();

    console.log(`Processed ${processed} order(s). Updated ${updated}.`);
  } catch (error) {
    logger.error("Error updating order reg values:", error);
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  }
}

run(parseArgs());
