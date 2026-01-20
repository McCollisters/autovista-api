#!/usr/bin/env tsx
/**
 * Backfill order agents using booking user info.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-backfill-order-agents.ts
 *   tsx -r dotenv/config scripts/run-backfill-order-agents.ts --dry-run
 *   tsx -r dotenv/config scripts/run-backfill-order-agents.ts --limit=500
 *   tsx -r dotenv/config scripts/run-backfill-order-agents.ts --include-mmi
 *   tsx -r dotenv/config scripts/run-backfill-order-agents.ts --include-customer-portal
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { logger } from "../src/core/logger";
import { Order, User } from "../src/_global/models";
import { MMI_PORTALS } from "../src/_global/constants/portalIds";

interface ScriptOptions {
  dryRun?: boolean;
  limit?: number;
  includeMmi?: boolean;
  includeCustomerPortal?: boolean;
}

const parseLimit = (value?: string) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const buildUserName = (user: any) => {
  const fullName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || user?.email || "Unknown User";
};

async function run(options: ScriptOptions = {}) {
  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    const agentMissingQuery = {
      $or: [{ agents: { $exists: false } }, { agents: { $size: 0 } }, { agents: null }],
    };
    const baseQuery: Record<string, any> = {
      userId: { $exists: true, $ne: null },
      ...agentMissingQuery,
    };

    if (!options.includeCustomerPortal) {
      baseQuery.$and = [
        {
          $or: [
            { isCustomerPortal: { $exists: false } },
            { isCustomerPortal: { $ne: true } },
          ],
        },
      ];
    }

    if (!options.includeMmi) {
      baseQuery.portalId = { $nin: MMI_PORTALS };
    }

    const limit = options.limit ?? 0;

    const query = Order.find(baseQuery)
      .select({ _id: 1, userId: 1, portalId: 1, refId: 1, agents: 1 })
      .sort({ createdAt: -1 });

    if (limit > 0) {
      query.limit(limit);
    }

    const cursor = query.cursor();

    let scanned = 0;
    let updated = 0;
    let skippedNoUser = 0;
    let skippedNoEmail = 0;

    for await (const order of cursor) {
      scanned += 1;

      const userId = order.userId;
      if (!userId) {
        skippedNoUser += 1;
        continue;
      }

      const user = await User.findById(userId).lean();
      if (!user) {
        skippedNoUser += 1;
        logger.warn("Skipping order without booking user", {
          orderId: order._id,
          refId: order.refId,
          userId,
        });
        continue;
      }

      if (!user.email) {
        skippedNoEmail += 1;
        logger.warn("Skipping order - user missing email", {
          orderId: order._id,
          refId: order.refId,
          userId,
        });
        continue;
      }

      const agent = {
        email: user.email,
        name: buildUserName(user),
        pickup: true,
        delivery: true,
      };

      if (options.dryRun) {
        console.log(
          `[dry-run] Would set agents on order ${order.refId} (${order._id}) to ${agent.email}`,
        );
        updated += 1;
        continue;
      }

      await Order.updateOne(
        { _id: order._id },
        { $set: { agents: [agent] } },
      );
      updated += 1;
    }

    console.log("\nBackfill summary:");
    console.log(`  Scanned: ${scanned}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped (no user): ${skippedNoUser}`);
    console.log(`  Skipped (user missing email): ${skippedNoEmail}`);
  } catch (error) {
    logger.error("Error backfilling order agents:", error);
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
  includeMmi: args.includes("--include-mmi"),
  includeCustomerPortal: args.includes("--include-customer-portal"),
};

const limitArg = args.find((arg) => arg.startsWith("--limit="));
options.limit = parseLimit(limitArg?.split("=")[1]);

run(options);
