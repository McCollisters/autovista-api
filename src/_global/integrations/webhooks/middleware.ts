/**
 * Webhook Middleware
 *
 * This file contains middleware functions for webhook processing.
 * It provides rate limiting and payload validation.
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "@/core/logger";
import { createRateLimit } from "@/core/middleware/security";
import { IWebhookPayload, WebhookSource } from "./types";

// Webhook-specific rate limiting (more lenient than API endpoints)
export const webhookRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  200, // Allow more requests for webhooks
  "Too many webhook requests from this IP, please try again later.",
);

// Webhook payload validation middleware
export const validateWebhookPayload = (source: WebhookSource) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = req.body as IWebhookPayload;

      // Basic payload validation
      if (
        !payload.id ||
        !payload.timestamp ||
        !payload.event ||
        !payload.data
      ) {
        return res.status(400).json({
          error: "Invalid webhook payload",
          message: "Payload must include id, timestamp, event, and data fields",
        });
      }

      // Validate timestamp format
      const timestamp = new Date(payload.timestamp);
      if (isNaN(timestamp.getTime())) {
        return res.status(400).json({
          error: "Invalid timestamp",
          message: "Timestamp must be a valid ISO 8601 date string",
        });
      }

      // Validate source matches
      if (payload.source !== source) {
        return res.status(400).json({
          error: "Source mismatch",
          message: `Expected source '${source}', got '${payload.source}'`,
        });
      }

      // Add validated payload to request
      req.webhookPayload = payload;
      next();
    } catch (error) {
      logger.error("Error validating webhook payload", {
        error: error instanceof Error ? error.message : error,
        ip: req.ip,
        url: req.url,
      });

      return res.status(400).json({
        error: "Payload validation failed",
        message: "An error occurred while validating the webhook payload",
      });
    }
  };
};

// Webhook logging middleware
export const webhookLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startTime = Date.now();

  logger.info("Webhook request received", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    contentType: req.get("Content-Type"),
    contentLength: req.get("Content-Length"),
    webhookId: req.webhookPayload?.id,
    webhookEvent: req.webhookPayload?.event,
    webhookSource: req.webhookPayload?.source,
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any): any {
    const duration = Date.now() - startTime;

    logger.info("Webhook request completed", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      webhookId: req.webhookPayload?.id,
      webhookEvent: req.webhookPayload?.event,
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Webhook error handling middleware
export const webhookErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  logger.error("Webhook processing error", {
    error: err.message,
    stack: err.stack,
    ip: req.ip,
    url: req.url,
    webhookId: req.webhookPayload?.id,
    webhookEvent: req.webhookPayload?.event,
  });

  // Don't expose internal errors to webhook senders
  res.status(500).json({
    error: "Webhook processing failed",
    message: "An internal error occurred while processing the webhook",
    processedAt: new Date().toISOString(),
  });
};

// Extend Express Request interface to include webhook payload
declare global {
  namespace Express {
    interface Request {
      webhookPayload?: IWebhookPayload;
    }
  }
}
