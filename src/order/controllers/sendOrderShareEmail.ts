import express from "express";
import { Order } from "@/_global/models";
import { sendOrderCustomerPublicNew } from "../notifications/sendOrderCustomerPublicNew";
import { logger } from "@/core/logger";

/**
 * POST /api/v1/order/:orderId/email
 * Sends the customer order confirmation email to an arbitrary recipient (share via email).
 */
export const sendOrderShareEmail = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const recipientEmail = String(req.body?.email || "").trim();

    if (!recipientEmail) {
      return next({ statusCode: 400, message: "Recipient email is required." });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return next({ statusCode: 404, message: "Order not found." });
    }

    const result = await sendOrderCustomerPublicNew(order, {
      recipientEmail,
      variant: "share",
    });

    if (!result.success) {
      return next({
        statusCode: 500,
        message: result.error || "Failed to send order email.",
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Error sending order share email", {
      error: error instanceof Error ? error.message : String(error),
      orderId: req.params?.orderId,
    });
    next(error);
  }
};
