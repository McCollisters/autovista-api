/**
 * Captivated Callback Controller
 *
 * Handles location updates from Captivated SMS service
 * Updates driver location in order when driver responds to location request
 */

import express from "express";
import { Order } from "@/_global/models";
import { logger } from "@/core/logger";

export const captivatedCallback = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { latitude, longitude, updated_at, message_id } = req.body;

    if (!message_id) {
      logger.warn("Captivated callback missing message_id");
      return next({
        statusCode: 400,
        message: "message_id is required.",
      });
    }

    // Find order by captivatedId
    const order = await Order.findOne({ "driver.captivatedId": message_id });

    if (!order) {
      logger.error("Order not found for Captivated callback", {
        message_id,
      });
      return next({
        statusCode: 404,
        message: "Order not found.",
      });
    }

    // Update driver location if provided
    if (latitude !== undefined) {
      order.driver.latitude = latitude.toString();
    }

    if (longitude !== undefined) {
      order.driver.longitude = longitude.toString();
    }

    if (updated_at) {
      order.driver.updatedAt = new Date(updated_at);
    } else {
      order.driver.updatedAt = new Date();
    }

    const savedOrder = await order.save();

    logger.info("Driver location updated via Captivated callback", {
      orderId: order._id,
      refId: order.refId,
      message_id,
      latitude,
      longitude,
    });

    res.status(200).json(savedOrder);
  } catch (error) {
    logger.error("Error processing Captivated callback", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body,
    });
    return next({
      statusCode: 500,
      message: "Error updating driver location.",
    });
  }
};
