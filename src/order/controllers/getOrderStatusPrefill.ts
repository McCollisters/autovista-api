import express from "express";
import { logger } from "@/core/logger";
import { verifyOrderStatusPrefillToken } from "@/_global/utils/orderStatusPrefillToken";

/**
 * GET /api/v1/order/status-prefill?token=...
 *
 * Public endpoint: resolves a signed order-status prefill token to an email
 * so the customer portal can autofill the login form without putting PII in
 * the confirmation email URL.
 */
export const getOrderStatusPrefill = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const token =
      typeof req.query.token === "string" ? req.query.token.trim() : "";

    if (!token) {
      return next({
        statusCode: 400,
        message: "Token is required.",
      });
    }

    const result = verifyOrderStatusPrefillToken(token);
    if (!result) {
      return next({
        statusCode: 400,
        message: "Invalid or expired token.",
      });
    }

    res.status(200).json({ email: result.email });
  } catch (error) {
    logger.error("Error resolving order status prefill token", {
      error: error instanceof Error ? error.message : error,
    });
    next({
      statusCode: 500,
      message: "There was an error resolving this token.",
    });
  }
};
