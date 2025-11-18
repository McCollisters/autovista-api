#!/usr/bin/env tsx
/**
 * Unsubscribe from Webhook Script
 *
 * Unsubscribes from a webhook in an external service (e.g., Super Dispatch).
 * This script manages webhook unsubscriptions via API calls to external services.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-webhook-unsubscribe.ts --source superdispatch --event order.delivered
 *   tsx -r dotenv/config scripts/run-webhook-unsubscribe.ts --source superdispatch --webhook-id <id>
 *
 * Note: This script manages unsubscriptions from external webhook services.
 */

import "dotenv/config";
import { authenticateSuperDispatch } from "../src/_global/integrations/authenticateSuperDispatch";
import { logger } from "../src/core/logger";

interface UnsubscribeOptions {
  source: string;
  event?: string;
  webhookId?: string;
}

async function unsubscribeFromWebhook(options: UnsubscribeOptions) {
  try {
    console.log("\n🔕 Unsubscribing from Webhook");
    console.log("=".repeat(80));
    console.log(`\nSource: ${options.source}`);
    if (options.event) {
      console.log(`Event: ${options.event}`);
    }
    if (options.webhookId) {
      console.log(`Webhook ID: ${options.webhookId}`);
    }

    // Unsubscribe based on source
    if (options.source === "superdispatch") {
      // Authenticate with Super Dispatch
      const token = await authenticateSuperDispatch();
      console.log("✅ Authenticated with Super Dispatch");

      // TODO: Implement Super Dispatch webhook unsubscription API
      // This requires the Super Dispatch API endpoint for webhook unsubscriptions
      // Example:
      // const webhookId = options.webhookId || await findWebhookIdByEvent(options.event);
      // const response = await fetch(`https://api.shipper.superdispatch.com/v1/webhooks/${webhookId}`, {
      //   method: 'DELETE',
      //   headers: {
      //     'Authorization': `Bearer ${token}`,
      //   },
      // });

      console.log("\n⚠️  WARNING: Super Dispatch webhook unsubscription API not yet implemented.");
      console.log("This script is a placeholder. Please implement the Super Dispatch webhook unsubscription endpoint.");
      console.log("\nRequired information:");
      console.log("  - Super Dispatch webhook unsubscription endpoint URL");
      console.log("  - Webhook ID lookup mechanism");

      logger.warn("Super Dispatch webhook unsubscription not implemented");
    } else if (options.source === "carrier") {
      // TODO: Implement carrier webhook unsubscription
      console.log("\n⚠️  WARNING: Carrier webhook unsubscription not yet implemented.");
      console.log("This script is a placeholder. Please implement the carrier webhook unsubscription.");
      
      logger.warn("Carrier webhook unsubscription not implemented");
    } else {
      console.log(`\n⚠️  Unknown webhook source: ${options.source}`);
      console.log("Supported sources: superdispatch, carrier");
      process.exit(1);
    }

    console.log("\n✅ Webhook unsubscription process completed");
  } catch (error) {
    logger.error("Error unsubscribing from webhook:", error);
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: UnsubscribeOptions = {
  source: "",
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--source" && args[i + 1]) {
    options.source = args[i + 1];
    i++;
  } else if (arg === "--event" && args[i + 1]) {
    options.event = args[i + 1];
    i++;
  } else if (arg === "--webhook-id" && args[i + 1]) {
    options.webhookId = args[i + 1];
    i++;
  } else if (arg === "--help" || arg === "-h") {
    console.log(`
Usage: tsx -r dotenv/config scripts/run-webhook-unsubscribe.ts [options]

Required Options:
  --source <source>       Webhook source (superdispatch, carrier)

Required (one of):
  --event <event>         Webhook event type (e.g., order.delivered)
  --webhook-id <id>       Webhook subscription ID

Optional Options:
  --help, -h              Show this help message

Examples:
  tsx -r dotenv/config scripts/run-webhook-unsubscribe.ts --source superdispatch --event order.delivered
  tsx -r dotenv/config scripts/run-webhook-unsubscribe.ts --source superdispatch --webhook-id abc123
  tsx -r dotenv/config scripts/run-webhook-unsubscribe.ts --source carrier --event carrier.accepted
`);
    process.exit(0);
  }
}

// Validate required fields
if (!options.source) {
  console.error("Error: --source is required");
  console.log("Use --help for usage information");
  process.exit(1);
}

if (!options.event && !options.webhookId) {
  console.error("Error: Either --event or --webhook-id is required");
  console.log("Use --help for usage information");
  process.exit(1);
}

// Run the script
unsubscribeFromWebhook(options);

