import express from "express";
import { Order } from "@/_global/models";
import { logger } from "@/core/logger";

/**
 * GET /api/v1/order/:orderId/activities
 * Get order activities (returns the full order for activity tracking)
 */
export const getOrderActivities = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
      return next({
        statusCode: 404,
        message: "Order not found.",
      });
    }

    res.status(200).json(order);
  } catch (error) {
    logger.error("Error getting order activities", {
      error: error instanceof Error ? error.message : error,
      orderId: req.params.orderId,
    });
    next({
      statusCode: 500,
      message: "There was an error getting order activities.",
    });
  }
};
