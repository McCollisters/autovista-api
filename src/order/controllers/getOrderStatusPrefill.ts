import express from "express";
import { logger } from "@/core/logger";
import { verifyOrderStatusPrefillToken } from "@/_global/utils/orderStatusPrefillToken";
import { Order, Quote } from "@/_global/models";
import { resolveOrderCustomerEmailForTracking } from "../utils/resolveOrderCustomerEmailForTracking";

/**
 * GET /api/v1/order/status-prefill?token=...
 *
 * Public endpoint: resolves an encrypted prefill token to an email (and, for
 * quote tokens, optional confirmation code / quoteId) so the customer portal
 * can autofill without putting PII in outbound email URLs.
 *
 * When the token binds quoteId/orderId, those resources are re-checked so a
 * leaked token cannot return credentials for a mismatched record.
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

    if (result.quoteId) {
      const quote = await Quote.findById(result.quoteId)
        .select("customer.email customer.quoteConfirmationCode customer.trackingCode")
        .lean();
      const quoteEmail = String(quote?.customer?.email || "")
        .trim()
        .toLowerCase();
      if (!quote || quoteEmail !== result.email) {
        return next({
          statusCode: 400,
          message: "Invalid or expired token.",
        });
      }

      if (result.code) {
        const expectedCode = String(
          quote.customer?.quoteConfirmationCode ||
            quote.customer?.trackingCode ||
            "",
        )
          .trim()
          .toUpperCase();
        if (
          !expectedCode ||
          expectedCode !== String(result.code).trim().toUpperCase()
        ) {
          return next({
            statusCode: 400,
            message: "Invalid or expired token.",
          });
        }
      }
    }

    if (result.orderId) {
      const order = await Order.findById(result.orderId).lean();
      const orderEmail = resolveOrderCustomerEmailForTracking(order as any);
      if (!order || !orderEmail || orderEmail !== result.email) {
        return next({
          statusCode: 400,
          message: "Invalid or expired token.",
        });
      }
    }

    const response: { email: string; code?: string; quoteId?: string } = {
      email: result.email,
    };
    if (result.code) {
      response.code = result.code;
    }
    if (result.quoteId) {
      response.quoteId = result.quoteId;
    }

    res.status(200).json(response);
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
