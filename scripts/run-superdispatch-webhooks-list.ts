#!/usr/bin/env tsx
/**
 * List Super Dispatch Webhooks (Remote)
 *
 * Fetches currently subscribed webhooks from Super Dispatch and logs them.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-superdispatch-webhooks-list.ts
 */

import "dotenv/config";
import { authenticateSuperDispatch } from "../src/_global/integrations/authenticateSuperDispatch";
import { logger } from "../src/core/logger";

const run = async () => {
  try {
    const token = await authenticateSuperDispatch();
    const apiUrl =
      process.env.SUPERDISPATCH_API_URL ||
      "https://api.shipper.superdispatch.com/v1/public";

    const response = await fetch(`${apiUrl}/webhooks`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Super Dispatch webhook list failed", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      process.exit(1);
    }

    const data = await response.json();
    console.log("\nSuper Dispatch Webhooks:");
    console.log("=".repeat(80));
    console.log(JSON.stringify(data, null, 2));
    console.log("=".repeat(80));
  } catch (error) {
    logger.error("Error listing Super Dispatch webhooks:", error);
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

run();
