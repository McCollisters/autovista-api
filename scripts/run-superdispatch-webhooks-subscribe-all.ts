#!/usr/bin/env tsx
/**
 * Subscribe all Super Dispatch webhooks to a new base URL.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-superdispatch-webhooks-subscribe-all.ts
 *   tsx -r dotenv/config scripts/run-superdispatch-webhooks-subscribe-all.ts --base-url https://dtq1ccc62md88.cloudfront.net
 *   tsx -r dotenv/config scripts/run-superdispatch-webhooks-subscribe-all.ts --callback-prefix /api/v1/callback
 *   tsx -r dotenv/config scripts/run-superdispatch-webhooks-subscribe-all.ts --callback-url https://example.com/callback
 *   tsx -r dotenv/config scripts/run-superdispatch-webhooks-subscribe-all.ts --audit-fields number,price,pickup.venue.name
 *   tsx -r dotenv/config scripts/run-superdispatch-webhooks-subscribe-all.ts --dry-run
 */

import "dotenv/config";
import { authenticateSuperDispatch } from "../src/_global/integrations/authenticateSuperDispatch";
import { logger } from "../src/core/logger";

type WebhookSpec = {
  action: string;
  callbackPath: string;
};

const webhookSpecs: WebhookSpec[] = [
  { action: "offer.accepted", callbackPath: "/callback/carrier-accepted" },
  {
    action: "offer.canceled_by_carrier",
    callbackPath: "/callback/carrier-canceled",
  },
  { action: "offer.sent", callbackPath: "/callback/offer-sent" },
  { action: "order.cancel", callbackPath: "/callback/order-cancel" },
  { action: "order.delivered", callbackPath: "/callback/order-delivered" },
  { action: "order.invoiced", callbackPath: "/callback/order-invoiced" },
  {
    action: "order.manually_marked_as_accepted",
    callbackPath: "/callback/accepted-carrier",
  },
  {
    action: "order.manually_marked_as_delivered",
    callbackPath: "/callback/order-delivered",
  },
  {
    action: "order.manually_marked_as_invoiced",
    callbackPath: "/callback/order-invoiced",
  },
  {
    action: "order.manually_marked_as_picked_up",
    callbackPath: "/callback/order-picked-up",
  },
  { action: "order.modified", callbackPath: "/callback/order-modified" },
  { action: "order.picked_up", callbackPath: "/callback/order-picked-up" },
  { action: "order.removed", callbackPath: "/callback/order-modified" },
  { action: "vehicle.modified", callbackPath: "/callback/vehicle-modified" },
];

const getArgValue = (args: string[], flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : undefined;
};

const run = async () => {
  const args = process.argv.slice(2);
  const callbackUrlOverride = getArgValue(args, "--callback-url");
  const baseUrl =
    getArgValue(args, "--base-url") ||
    process.env.WEBHOOK_BASE_URL ||
    "https://dtq1ccc62md88.cloudfront.net";
  const callbackPrefix = getArgValue(args, "--callback-prefix") || "";
  const auditFieldsRaw = getArgValue(args, "--audit-fields");
  const auditFieldSet = auditFieldsRaw
    ? auditFieldsRaw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : undefined;
  const dryRun = args.includes("--dry-run");

  const apiUrl =
    process.env.SUPERDISPATCH_API_URL ||
    "https://api.shipper.superdispatch.com/v1/public";

  if (!callbackUrlOverride && !baseUrl.startsWith("http")) {
    console.error("Invalid --base-url. Must start with http/https.");
    process.exit(1);
  }

  try {
    const token = await authenticateSuperDispatch();

    console.log("\nSubscribing Super Dispatch webhooks");
    console.log("=".repeat(80));
    console.log(`API URL: ${apiUrl}`);
    console.log(`Base URL: ${baseUrl}`);
    if (callbackUrlOverride) {
      console.log(`Callback URL override: ${callbackUrlOverride}`);
    }
    console.log(`Callback prefix: ${callbackPrefix || "(none)"}`);
    if (auditFieldSet?.length) {
      console.log(`Audit field set: ${auditFieldSet.join(", ")}`);
    }
    console.log(`Dry run: ${dryRun ? "yes" : "no"}`);
    console.log("=".repeat(80));

    for (const spec of webhookSpecs) {
      const callbackUrl =
        callbackUrlOverride ||
        `${baseUrl}${callbackPrefix}${spec.callbackPath}`;
      const payload = {
        action: spec.action,
        callback_url: callbackUrl,
        ...(auditFieldSet ? { audit_field_set: auditFieldSet } : {}),
      };

      if (dryRun) {
        console.log(`[dry-run] ${spec.action} -> ${callbackUrl}`);
        continue;
      }

      const response = await fetch(
        `${apiUrl}/webhooks/${encodeURIComponent(spec.action)}/subscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Webhook subscribe failed", {
          action: spec.action,
          callbackUrl,
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        console.log(`❌ ${spec.action} -> ${callbackUrl} (${response.status})`);
        continue;
      }

      console.log(`✅ ${spec.action} -> ${callbackUrl}`);
    }
  } catch (error) {
    logger.error("Error subscribing Super Dispatch webhooks:", error);
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

run();
