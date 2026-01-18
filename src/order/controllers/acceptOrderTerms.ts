import express from "express";
import { Order } from "@/_global/models";
import { logger } from "@/core/logger";

/**
 * POST /api/v1/order/terms
 * Accept order terms
 *
 * Body: { uniqueId: string, orderId: string }
 * Sets hasAcceptedTerms to true if uniqueId matches
 */
export const acceptOrderTerms = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { uniqueId, orderId, termsAcceptedName } = req.body;

    if (!orderId) {
      return next({
        statusCode: 400,
        message: "Order ID is required.",
      });
    }

    if (!uniqueId) {
      return next({
        statusCode: 400,
        message: "Unique ID is required.",
      });
    }

    if (!termsAcceptedName || !String(termsAcceptedName).trim()) {
      return next({
        statusCode: 400,
        message: "Name is required to accept the terms.",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      logger.error("Order not found for terms acceptance", { orderId });
      return next({
        statusCode: 404,
        message: "Order not found.",
      });
    }

    // Verify uniqueId matches
    if (order.refId?.toString() !== uniqueId.toString()) {
      return next({
        statusCode: 403,
        message: "Invalid order reference ID.",
      });
    }

    // Accept terms
    if (!order.notifications) {
      order.notifications = {} as any;
    }
    order.notifications.hasAcceptedTerms = true;
    order.notifications.termsAcceptedName = String(termsAcceptedName).trim();
    await order.save();

    logger.info(`Customer accepted order terms for ${order.refId}`, {
      orderId: order._id,
      refId: order.refId,
    });

    res.status(200).json({ uniqueId: order.refId });
  } catch (error) {
    logger.error("Error accepting order terms", {
      error: error instanceof Error ? error.message : error,
      orderId: req.body?.orderId,
    });
    next({
      statusCode: 500,
      message: "There was an error updating this order.",
    });
  }
};
