import express from "express";
import { Order } from "@/_global/models";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";

/**
 * PUT /mcadmin/order/:orderId/file
 * Remove a file from an order
 */
export const removeOrderFile = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));

    if (!authUser) {
      return next({
        statusCode: 401,
        message: "Unauthorized",
      });
    }

    const { orderId } = req.params;
    const { url } = req.body;

    if (!url) {
      return next({
        statusCode: 400,
        message: "File URL is required.",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return next({
        statusCode: 404,
        message: "Order not found.",
      });
    }

    if (!order.files || order.files.length === 0) {
      return next({
        statusCode: 404,
        message: "No files found on this order.",
      });
    }

    // Remove file by URL
    const initialLength = order.files.length;
    order.files = order.files.filter((file) => file.url !== url);

    if (order.files.length === initialLength) {
      return next({
        statusCode: 404,
        message: "File not found on this order.",
      });
    }

    const savedOrder = await order.save();

    logger.info(`User ${authUser.email} removed file from order ${orderId}`, {
      userId: authUser._id,
      orderId,
      fileUrl: url,
    });

    res.status(200).json(savedOrder);
  } catch (error) {
    logger.error("Error removing file from order", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      orderId: req.params.orderId,
    });

    return next({
      statusCode: 500,
      message: "There was an error removing this file.",
    });
  }
};

