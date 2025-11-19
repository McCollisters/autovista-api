import express from "express";
import { Order, Portal } from "@/_global/models";
import { logger } from "@/core/logger";

/**
 * POST /api/v1/order/:orderId/status
 * Get order status for customer tracking
 * 
 * Body: { email: string, order_id?: string }
 * Validates email matches customer email and portal allows tracking
 */
export const getOrderStatus = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const orderId = req.body.order_id || req.params.orderId;
    const { email } = req.body;

    if (!orderId || typeof orderId !== "string") {
      return next({
        statusCode: 400,
        message: "Sorry, we could not find this order.",
      });
    }

    if (!email) {
      return next({
        statusCode: 400,
        message: "Email is required.",
      });
    }

    // Try to find order by ID or uniqueId (refId)
    let order;
    if (orderId.length < 7) {
      // Likely a refId (uniqueId)
      order = await Order.findOne({ refId: parseInt(orderId, 10) }).populate("portalId");
    } else {
      // Likely a MongoDB ObjectId
      order = await Order.findById(orderId).populate("portalId");
    }

    if (!order) {
      return next({
        statusCode: 404,
        message: "Sorry, we could not find this order.",
      });
    }

    // Check if portal allows customer tracking
    const portal = await Portal.findById(order.portalId);
    if (portal && (portal as any).allowsCustomerTracking === false) {
      return next({
        statusCode: 403,
        message: "Sorry, this order is not available for status tracking.",
      });
    }

    // Verify email matches customer email
    const customerEmail = order.customer?.email?.toLowerCase();
    if (!customerEmail || customerEmail !== email.toLowerCase()) {
      return next({
        statusCode: 403,
        message:
          "You do not have permission to access this order. If you believe this is in error, please contact us for assistance.",
      });
    }

    res.status(200).json(order);
  } catch (error) {
    logger.error("Error getting order status", {
      error: error instanceof Error ? error.message : error,
      orderId: req.body?.order_id || req.params?.orderId,
    });
    next({
      statusCode: 500,
      message: "There was an error getting this order's status.",
    });
  }
};

