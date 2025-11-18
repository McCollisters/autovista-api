#!/usr/bin/env tsx
/**
 * Subscribe to Webhook Script
 *
 * Subscribes to a webhook in an external service (e.g., Super Dispatch).
 * This script manages webhook subscriptions via API calls to external services.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-webhook-subscribe.ts --source superdispatch --event order.delivered
 *
 * Note: This script manages subscriptions to external webhook services.
 * The webhook handlers themselves are registered in the codebase.
 */

import "dotenv/config";
import { authenticateSuperDispatch } from "../src/_global/integrations/authenticateSuperDispatch";
import { getWebhookConfiguration } from "../src/_global/integrations/webhooks";
import { logger } from "../src/core/logger";

interface SubscribeOptions {
  source: string;
  event: string;
  url?: string;
}

async function subscribeToWebhook(options: SubscribeOptions) {
  try {
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const webhookConfig = getWebhookConfiguration();

    console.log("\n🔔 Subscribing to Webhook");
    console.log("=".repeat(80));
    console.log(`\nSource: ${options.source}`);
    console.log(`Event: ${options.event}`);

    // Determine webhook URL
    let webhookUrl = options.url;
    if (!webhookUrl) {
      if (options.source === "superdispatch") {
        webhookUrl = `${webhookConfig.superdispatch.baseUrl}/${options.event}`;
      } else if (options.source === "carrier") {
        webhookUrl = `${webhookConfig.carrier.baseUrl}/${options.event}`;
      } else {
        webhookUrl = `${baseUrl}/api/v1/webhooks/${options.source}/${options.event}`;
      }
    }

    console.log(`Webhook URL: ${webhookUrl}`);

    // Subscribe based on source
    if (options.source === "superdispatch") {
      // Authenticate with Super Dispatch
      const token = await authenticateSuperDispatch();
      console.log("✅ Authenticated with Super Dispatch");

      // TODO: Implement Super Dispatch webhook subscription API
      // This requires the Super Dispatch API endpoint for webhook subscriptions
      // Example:
      // const response = await fetch('https://api.shipper.superdispatch.com/v1/webhooks', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${token}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     event: options.event,
      //     url: webhookUrl,
      //   }),
      // });

      console.log(
        "\n⚠️  WARNING: Super Dispatch webhook subscription API not yet implemented.",
      );
      console.log(
        "This script is a placeholder. Please implement the Super Dispatch webhook subscription endpoint.",
      );
      console.log("\nRequired information:");
      console.log("  - Super Dispatch webhook subscription endpoint URL");
      console.log("  - Webhook event mapping");
      console.log("  - Webhook secret/authentication");

      logger.warn("Super Dispatch webhook subscription not implemented");
    } else if (options.source === "carrier") {
      // TODO: Implement carrier webhook subscription
      console.log(
        "\n⚠️  WARNING: Carrier webhook subscription not yet implemented.",
      );
      console.log(
        "This script is a placeholder. Please implement the carrier webhook subscription.",
      );

      logger.warn("Carrier webhook subscription not implemented");
    } else {
      console.log(`\n⚠️  Unknown webhook source: ${options.source}`);
      console.log("Supported sources: superdispatch, carrier");
      process.exit(1);
    }

    console.log("\n✅ Webhook subscription process completed");
  } catch (error) {
    logger.error("Error subscribing to webhook:", error);
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: SubscribeOptions = {
  source: "",
  event: "",
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--source" && args[i + 1]) {
    options.source = args[i + 1];
    i++;
  } else if (arg === "--event" && args[i + 1]) {
    options.event = args[i + 1];
    i++;
  } else if (arg === "--url" && args[i + 1]) {
    options.url = args[i + 1];
    i++;
  } else if (arg === "--help" || arg === "-h") {
    console.log(`
Usage: tsx -r dotenv/config scripts/run-webhook-subscribe.ts [options]

Required Options:
  --source <source>    Webhook source (superdispatch, carrier)
  --event <event>      Webhook event type (e.g., order.delivered, carrier.accepted)

Optional Options:
  --url <url>          Custom webhook URL (defaults to system-generated URL)
  --help, -h           Show this help message

Examples:
  tsx -r dotenv/config scripts/run-webhook-subscribe.ts --source superdispatch --event order.delivered
  tsx -r dotenv/config scripts/run-webhook-subscribe.ts --source carrier --event carrier.accepted
  tsx -r dotenv/config scripts/run-webhook-subscribe.ts --source superdispatch --event order.delivered --url https://example.com/webhook
`);
    process.exit(0);
  }
}

// Validate required fields
if (!options.source || !options.event) {
  console.error("Error: --source and --event are required");
  console.log("Use --help for usage information");
  process.exit(1);
}

// Run the script
subscribeToWebhook(options);
