#!/usr/bin/env tsx
/**
 * Update orders with MMI portal IDs to have two agents:
 * - autodesk@graebel.com (notifications disabled)
 * - autodeskupdates@graebel.com (notifications enabled)
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-update-mmi-orders-agents.ts
 *   tsx -r dotenv/config scripts/run-update-mmi-orders-agents.ts --dry-run
 *   tsx -r dotenv/config scripts/run-update-mmi-orders-agents.ts --limit=500
 */

import "dotenv/config";
import mongoose from "mongoose";
import { Types } from "mongoose";
import { config } from "../src/config/environment";
import { logger } from "../src/core/logger";
import { Order } from "../src/_global/models";

const TARGET_PORTAL_IDS = [
  "60d364c5176cba0017cbd78f",
  "67d036b3e29c00962804a466",
];

const TARGET_AGENTS = [
  {
    name: "Auto Desk",
    email: "autodesk@graebel.com",
    enablePickupNotifications: false,
    enableDeliveryNotifications: false,
  },
  {
    name: "Auto Desk",
    email: "autodeskupdates@graebel.com",
    enablePickupNotifications: true,
    enableDeliveryNotifications: true,
  },
];

interface ScriptOptions {
  dryRun?: boolean;
  limit?: number;
}

const parseLimit = (value?: string) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

async function run(options: ScriptOptions = {}) {
  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    const query: Record<string, any> = {
      portalId: { $in: TARGET_PORTAL_IDS },
    };

    const limit = options.limit ?? 0;

    const findQuery = Order.find(query)
      .select({ _id: 1, portalId: 1, refId: 1, agents: 1 })
      .sort({ createdAt: -1 });

    if (limit > 0) {
      findQuery.limit(limit);
    }

    const cursor = findQuery.cursor();

    let scanned = 0;
    let updated = 0;
    let skipped = 0;

    for await (const order of cursor) {
      scanned += 1;

      const orderId = order._id;
      const refId = (order as any).refId;
      const portalId = String(order.portalId || "");
      const currentAgents = (order as any).agents || [];

      // Check if agents already match what we want
      const currentEmails = new Set(
        currentAgents.map((agent: any) =>
          String(agent?.email || "").toLowerCase().trim(),
        ),
      );
      const targetEmails = new Set(
        TARGET_AGENTS.map((agent) => agent.email.toLowerCase().trim()),
      );

      // Check if we have exactly the right agents
      const hasAllTargetAgents =
        currentAgents.length === TARGET_AGENTS.length &&
        Array.from(targetEmails).every((email) => currentEmails.has(email));

      if (hasAllTargetAgents) {
        // Check if the agents match exactly
        let matches = true;
        for (const targetAgent of TARGET_AGENTS) {
          const currentAgent = currentAgents.find(
            (agent: any) =>
              String(agent?.email || "").toLowerCase().trim() ===
              targetAgent.email.toLowerCase().trim(),
          );
          if (
            !currentAgent ||
            currentAgent.name !== targetAgent.name ||
            currentAgent.enablePickupNotifications !==
              targetAgent.enablePickupNotifications ||
            currentAgent.enableDeliveryNotifications !==
              targetAgent.enableDeliveryNotifications
          ) {
            matches = false;
            break;
          }
        }

        if (matches) {
          skipped += 1;
          logger.debug("Order already has correct agents", {
            orderId,
            refId,
            portalId,
          });
          continue;
        }
      }

      // Create new agent entries with _id
      const newAgents = TARGET_AGENTS.map((agent) => ({
        ...agent,
        _id: new Types.ObjectId(),
      }));

      if (options.dryRun) {
        console.log(
          `[dry-run] Would update order ${refId || orderId} (portal: ${portalId})`,
        );
        console.log(
          `  Current agents: ${JSON.stringify(currentAgents, null, 2)}`,
        );
        console.log(
          `  New agents: ${JSON.stringify(newAgents, null, 2)}`,
        );
        updated += 1;
        continue;
      }

      await Order.updateOne(
        { _id: orderId },
        { $set: { agents: newAgents } },
      );

      updated += 1;
      logger.info("Updated order agents", {
        orderId,
        refId,
        portalId,
        agentCount: newAgents.length,
        emails: newAgents.map((a) => a.email),
      });
    }

    console.log("\nUpdate summary:");
    console.log(`  Scanned: ${scanned}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped (already correct): ${skipped}`);
    console.log(`  Target portal IDs: ${TARGET_PORTAL_IDS.join(", ")}`);
  } catch (error) {
    logger.error("Error updating order agents:", error);
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

const limitArg = args.find((arg) => arg.startsWith("--limit="));
options.limit = parseLimit(limitArg?.split("=")[1]);

run(options);
