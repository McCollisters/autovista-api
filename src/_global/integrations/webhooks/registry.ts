/**
 * Webhook Registry
 *
 * This file provides a centralized registry for all webhook handlers.
 * It allows for easy registration, discovery, and management of webhook endpoints.
 */

import { Router } from "express";
import { logger } from "@/core/logger";
import {
  IWebhookRegistryEntry,
  WebhookEventType,
  WebhookSource,
  WebhookHandler,
  IWebhookResponse,
} from "./types";
import {
  validateWebhookPayload,
  webhookLogger,
  webhookErrorHandler,
} from "./middleware";

// Webhook registry storage
const webhookRegistry = new Map<string, IWebhookRegistryEntry>();

// Create webhook key from event and source
const createWebhookKey = (
  event: WebhookEventType,
  source: WebhookSource,
): string => {
  return `${source}:${event}`;
};

// Register a webhook handler
export const registerWebhook = (
  event: WebhookEventType,
  source: WebhookSource,
  handler: WebhookHandler,
  config: IWebhookRegistryEntry["config"] = { enabled: true },
): void => {
  const key = createWebhookKey(event, source);

  webhookRegistry.set(key, {
    event,
    source,
    handler,
    config,
  });

  logger.info("Webhook registered", {
    event,
    source,
    key,
    enabled: config.enabled,
  });
};

// Get webhook handler by event and source
export const getWebhookHandler = (
  event: WebhookEventType,
  source: WebhookSource,
): IWebhookRegistryEntry | undefined => {
  const key = createWebhookKey(event, source);
  return webhookRegistry.get(key);
};

// Get all registered webhooks
export const getAllWebhooks = (): IWebhookRegistryEntry[] => {
  return Array.from(webhookRegistry.values());
};

// Get webhooks by source
export const getWebhooksBySource = (
  source: WebhookSource,
): IWebhookRegistryEntry[] => {
  return getAllWebhooks().filter((webhook) => webhook.source === source);
};

// Get webhooks by event
export const getWebhooksByEvent = (
  event: WebhookEventType,
): IWebhookRegistryEntry[] => {
  return getAllWebhooks().filter((webhook) => webhook.event === event);
};

// Create webhook router
export const createWebhookRouter = (): Router => {
  const router = Router();

  // Apply webhook-specific middleware
  router.use(webhookLogger);
  // Rate limiting is handled by CloudFront

  // Generic webhook endpoint that routes based on payload
  router.post("/", async (req, res, next) => {
    try {
      const payload = req.webhookPayload;

      if (!payload) {
        return res.status(400).json({
          error: "Missing webhook payload",
          message: "Request must include a valid webhook payload",
        });
      }

      const webhookEntry = getWebhookHandler(
        payload.event as WebhookEventType,
        payload.source as WebhookSource,
      );

      if (!webhookEntry) {
        logger.warn("No handler found for webhook", {
          event: payload.event,
          source: payload.source,
          webhookId: payload.id,
        });

        return res.status(404).json({
          error: "No handler found",
          message: `No handler registered for event '${payload.event}' from source '${payload.source}'`,
        });
      }

      if (!webhookEntry.config.enabled) {
        logger.info("Webhook handler disabled", {
          event: payload.event,
          source: payload.source,
          webhookId: payload.id,
        });

        return res.status(200).json({
          success: true,
          message: "Webhook received but handler is disabled",
          processedAt: new Date().toISOString(),
          webhookId: payload.id,
        });
      }

      // Execute the webhook handler
      const result = await webhookEntry.handler(
        payload,
        req.headers as Record<string, string>,
      );

      res.status(200).json({
        ...result,
        processedAt: new Date().toISOString(),
        webhookId: payload.id,
      });
    } catch (error) {
      next(error);
    }
  });

  // Source-specific endpoints for better organization
  router.post("/superdispatch", async (req, res, next) => {
    try {
      // Super Dispatch sends raw payloads, not wrapped in our standard format
      const rawPayload = req.body;

      // Determine event type based on payload structure
      let eventType: WebhookEventType;

      // Check if this is an order cancelled webhook
      if (rawPayload.order_guid && !rawPayload.status) {
        eventType = "order.canceled";
      } else if (rawPayload.order_guid && rawPayload.status === "delivered") {
        eventType = "order.delivered";
      } else if (rawPayload.order_guid && rawPayload.status === "invoiced") {
        eventType = "order.invoiced";
      } else if (rawPayload.order_guid && rawPayload.status === "picked_up") {
        eventType = "order.picked_up";
      } else if (rawPayload.order_guid && rawPayload.status === "modified") {
        eventType = "order.modified";
      } else if (
        rawPayload.order_guid &&
        rawPayload.type === "vehicle_modified"
      ) {
        eventType = "vehicle.modified";
      } else if (rawPayload.order_guid && rawPayload.status) {
        eventType = "order.updated";
      } else {
        // Default fallback
        eventType = "order.updated";
      }

      const webhookEntry = getWebhookHandler(eventType, "superdispatch");

      if (!webhookEntry || !webhookEntry.config.enabled) {
        return res.status(404).json({
          error: "No handler found",
          message: `No enabled handler for Super Dispatch event '${eventType}'`,
        });
      }

      // Immediately respond to avoid timeout (following old API pattern)
      res.status(200).json({ received: true });

      // Process asynchronously
      webhookEntry
        .handler(rawPayload, req.headers as Record<string, string>)
        .then((result) => {
          logger.info("Super Dispatch webhook processed successfully", {
            eventType,
            orderGuid: rawPayload.order_guid,
            result,
          });
        })
        .catch((error) => {
          logger.error("Error processing Super Dispatch webhook", {
            eventType,
            orderGuid: rawPayload.order_guid,
            error: error instanceof Error ? error.message : error,
          });
        });
    } catch (error) {
      next(error);
    }
  });

  // Carrier webhook endpoint
  router.post("/carrier", async (req, res, next) => {
    try {
      // Carrier webhooks send raw payloads, not wrapped in our standard format
      const rawPayload = req.body;

      // Determine event type based on payload structure
      let eventType: WebhookEventType;

      // Check if this is a carrier accepted webhook
      if (rawPayload.carrier_guid && rawPayload.order_guid) {
        // Determine if it's accepted or canceled based on payload content
        // This might need to be adjusted based on actual carrier webhook structure
        if (
          rawPayload.status === "canceled" ||
          rawPayload.type === "canceled"
        ) {
          eventType = "carrier.canceled";
        } else {
          eventType = "carrier.accepted";
        }
      } else {
        // Default fallback
        eventType = "carrier.accepted";
      }

      const webhookEntry = getWebhookHandler(eventType, "carrier");

      if (!webhookEntry || !webhookEntry.config.enabled) {
        return res.status(404).json({
          error: "No handler found",
          message: `No enabled handler for carrier event '${eventType}'`,
        });
      }

      // Immediately respond to avoid timeout (following old API pattern)
      res.status(200).json({ received: true });

      // Process asynchronously
      webhookEntry
        .handler(rawPayload, req.headers as Record<string, string>)
        .then((result) => {
          logger.info("Carrier webhook processed successfully", {
            eventType,
            carrierGuid: rawPayload.carrier_guid,
            orderGuid: rawPayload.order_guid,
            result,
          });
        })
        .catch((error) => {
          logger.error("Error processing carrier webhook", {
            eventType,
            carrierGuid: rawPayload.carrier_guid,
            orderGuid: rawPayload.order_guid,
            error: error instanceof Error ? error.message : error,
          });
        });
    } catch (error) {
      next(error);
    }
  });

  // Webhook status endpoint
  router.get("/status", (req, res) => {
    const webhooks = getAllWebhooks();

    res.json({
      totalWebhooks: webhooks.length,
      enabledWebhooks: webhooks.filter((w) => w.config.enabled).length,
      disabledWebhooks: webhooks.filter((w) => !w.config.enabled).length,
      webhooks: webhooks.map((w) => ({
        event: w.event,
        source: w.source,
        enabled: w.config.enabled,
        hasSecret: !!w.config.secret,
        rateLimit: w.config.rateLimit,
      })),
    });
  });

  // Apply error handler
  router.use(webhookErrorHandler);

  return router;
};

// Export the router as default
export default createWebhookRouter;
