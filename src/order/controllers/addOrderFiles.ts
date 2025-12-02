import express from "express";
import { Order } from "@/_global/models";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";

/**
 * PUT /order/:orderId/files
 * Add files to order (MCAdmin only)
 */
export const addOrderFiles = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));

    if (!authUser || authUser.role !== "MCAdmin") {
      return next({
        statusCode: 401,
        message: "Unauthorized. MCAdmin access required.",
      });
    }

    const { orderId } = req.params;
    const files = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return next({
        statusCode: 400,
        message: "Files are required.",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return next({
        statusCode: 404,
        message: "Order not found.",
      });
    }

    // Initialize files array if it doesn't exist
    if (!order.files) {
      order.files = [];
    }

    // Add new files
    if (!order.files) {
      order.files = [];
    }
    files.forEach((file: { name: string; url: string; key: string }) => {
      const { name, url, key } = file;
      if (name && url && key) {
        order.files!.push({ name, url, key });
      }
    });

    const savedOrder = await order.save();

    logger.info(`User ${authUser.email} added files to order ${orderId}`, {
      userId: authUser._id,
      orderId,
      filesCount: files.length,
    });

    res.status(200).json(savedOrder);
  } catch (error) {
    logger.error("Error adding files to order", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      orderId: req.params.orderId,
    });

    return next({
      statusCode: 500,
      message: "There was an error adding files to this order.",
    });
  }
};

