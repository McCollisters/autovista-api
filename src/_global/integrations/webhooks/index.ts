/**
 * Webhook Initialization
 *
 * This file initializes all webhook handlers and registers them with the registry.
 * It serves as the central configuration point for all webhook endpoints.
 */

import { logger } from "@/core/logger";
import { registerWebhook } from "./registry";
import {
  handleSuperDispatchOrderCancelled,
  handleSuperDispatchOrderDelivered,
  handleSuperDispatchOrderInvoiced,
  handleSuperDispatchOrderModified,
  handleSuperDispatchOrderPickedUp,
  handleSuperDispatchOrderRemoved,
  handleSuperDispatchVehicleModified,
  handleCarrierAccepted,
  handleCarrierAcceptedByShipper,
  handleCarrierCanceled,
  handleOfferSent,
} from "./handlers";

/**
 * Initialize all webhook handlers
 *
 * This function registers all webhook handlers with the registry.
 * Add new webhook handlers here as you create them.
 */
export const initializeWebhooks = (): void => {
  logger.info("Initializing webhook handlers...");

  // Super Dispatch webhooks
  registerWebhook(
    "order.canceled",
    "superdispatch",
    handleSuperDispatchOrderCancelled,
    {
      enabled: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per window
      },
    },
  );

  registerWebhook(
    "order.delivered",
    "superdispatch",
    handleSuperDispatchOrderDelivered,
    {
      enabled: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per window
      },
    },
  );

  registerWebhook(
    "order.invoiced",
    "superdispatch",
    handleSuperDispatchOrderInvoiced,
    {
      enabled: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per window
      },
    },
  );

  registerWebhook(
    "order.modified",
    "superdispatch",
    handleSuperDispatchOrderModified,
    {
      enabled: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per window
      },
    },
  );

  registerWebhook(
    "order.picked_up",
    "superdispatch",
    handleSuperDispatchOrderPickedUp,
    {
      enabled: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per window
      },
    },
  );

  registerWebhook(
    "order.removed",
    "superdispatch",
    handleSuperDispatchOrderRemoved,
    {
      enabled: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per window
      },
    },
  );

  registerWebhook(
    "vehicle.modified",
    "superdispatch",
    handleSuperDispatchVehicleModified,
    {
      enabled: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per window
      },
    },
  );

  // Carrier webhooks
  registerWebhook("carrier.accepted", "carrier", handleCarrierAccepted, {
    enabled: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
    },
  });

  registerWebhook(
    "carrier.accepted_by_shipper",
    "carrier",
    handleCarrierAcceptedByShipper,
    {
      enabled: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per window
      },
    },
  );

  registerWebhook("carrier.canceled", "carrier", handleCarrierCanceled, {
    enabled: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
    },
  });

  registerWebhook("offer.sent", "carrier", handleOfferSent, {
    enabled: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
    },
  });

  logger.info("Webhook handlers initialized successfully", {
    totalHandlers: 11,
    enabledHandlers: 11,
  });
};

/**
 * Get webhook configuration for external services
 *
 * This function returns the webhook URLs and configuration
 * that external services need to configure their webhooks.
 */
export const getWebhookConfiguration = () => {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";

  return {
    superdispatch: {
      baseUrl: `${baseUrl}/api/v1/webhooks/superdispatch`,
      events: [
        "order.canceled",
        "order.delivered",
        "order.invoiced",
        "order.modified",
        "order.picked_up",
        "order.removed",
        "vehicle.modified",
      ],
    },
    carrier: {
      baseUrl: `${baseUrl}/api/v1/webhooks/carrier`,
      events: [
        "carrier.accepted",
        "carrier.accepted_by_shipper",
        "carrier.canceled",
        "offer.sent",
      ],
    },
  };
};

/**
 * Validate webhook environment configuration
 *
 * This function checks that all required environment variables
 * are set for webhook functionality.
 */
export const validateWebhookConfig = (): boolean => {
  // No environment variables required for Super Dispatch webhooks
  logger.info("Webhook configuration validated successfully");
  return true;
};
