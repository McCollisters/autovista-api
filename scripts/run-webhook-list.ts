#!/usr/bin/env tsx
/**
 * List Webhooks Script
 *
 * Lists all registered webhooks in the system.
 * Can filter by source or event type.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-webhook-list.ts
 *   tsx -r dotenv/config scripts/run-webhook-list.ts --source superdispatch
 *   tsx -r dotenv/config scripts/run-webhook-list.ts --event order.delivered
 */

import "dotenv/config";
import { getAllWebhooks } from "../src/_global/integrations/webhooks/registry";
import { logger } from "../src/core/logger";

interface ScriptOptions {
  source?: string;
  event?: string;
  format?: "json" | "table";
}

async function listWebhooks(options: ScriptOptions = {}) {
  try {
    // Get all webhooks
    const webhooks = getAllWebhooks();

    // Filter webhooks
    let filteredWebhooks = webhooks;
    if (options.source) {
      filteredWebhooks = filteredWebhooks.filter(
        (w) => w.source.toLowerCase() === options.source?.toLowerCase(),
      );
    }
    if (options.event) {
      filteredWebhooks = filteredWebhooks.filter(
        (w) => w.event.toLowerCase() === options.event?.toLowerCase(),
      );
    }

    if (filteredWebhooks.length === 0) {
      console.log("No webhooks found matching the criteria.");
      return;
    }

    // Display results
    if (options.format === "json") {
      console.log(
        JSON.stringify(
          filteredWebhooks.map((w) => ({
            event: w.event,
            source: w.source,
            enabled: w.config.enabled,
            hasSecret: !!w.config.secret,
            rateLimit: w.config.rateLimit,
          })),
          null,
          2,
        ),
      );
    } else {
      console.log(`\nFound ${filteredWebhooks.length} webhook(s):\n`);
      console.log("=".repeat(80));

      filteredWebhooks.forEach((webhook, index) => {
        console.log(`\n${index + 1}. ${webhook.event} (${webhook.source})`);
        console.log(
          `   Status: ${webhook.config.enabled ? "✅ Enabled" : "❌ Disabled"}`,
        );
        console.log(
          `   Secret: ${webhook.config.secret ? "✅ Configured" : "❌ Not configured"}`,
        );
        if (webhook.config.rateLimit) {
          console.log(
            `   Rate Limit: ${webhook.config.rateLimit.max} requests per ${webhook.config.rateLimit.windowMs / 1000 / 60} minutes`,
          );
        }
      });

      console.log("\n" + "=".repeat(80));
      console.log(`\nTotal: ${webhooks.length} webhook(s) registered`);
      console.log(
        `Enabled: ${webhooks.filter((w) => w.config.enabled).length}`,
      );
      console.log(
        `Disabled: ${webhooks.filter((w) => !w.config.enabled).length}`,
      );
    }

    logger.info(`Listed ${filteredWebhooks.length} webhook(s)`);
  } catch (error) {
    logger.error("Error listing webhooks:", error);
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: ScriptOptions = {
  format: "table",
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--source" && args[i + 1]) {
    options.source = args[i + 1];
    i++;
  } else if (arg === "--event" && args[i + 1]) {
    options.event = args[i + 1];
    i++;
  } else if (arg === "--format" && args[i + 1]) {
    options.format = args[i + 1] as "json" | "table";
    i++;
  } else if (arg === "--help" || arg === "-h") {
    console.log(`
Usage: tsx -r dotenv/config scripts/run-webhook-list.ts [options]

Options:
  --source <source>    Filter by webhook source (e.g., superdispatch, carrier)
  --event <event>      Filter by event type (e.g., order.delivered, carrier.accepted)
  --format <format>     Output format: json or table (default: table)
  --help, -h           Show this help message

Examples:
  tsx -r dotenv/config scripts/run-webhook-list.ts
  tsx -r dotenv/config scripts/run-webhook-list.ts --source superdispatch
  tsx -r dotenv/config scripts/run-webhook-list.ts --event order.delivered
  tsx -r dotenv/config scripts/run-webhook-list.ts --format json
`);
    process.exit(0);
  }
}

// Run the script
listWebhooks(options);
