import express from "express";
import { Order } from "@/_global/models";
import { sendOrderCustomerPublicNew } from "../notifications/sendOrderCustomerPublicNew";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
import { rejectDemoMutation } from "@/demo/respondWithDemo";

/**
 * POST /api/v1/order/:orderId/email
 * Authenticated: sends the customer order confirmation template to an arbitrary
 * recipient with share-variant subject and intro copy.
 */
export const sendOrderShareEmail = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    if (rejectDemoMutation(req, next)) {
      return;
    }

    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));
    if (!authUser) {
      return next({ statusCode: 401, message: "Unauthorized" });
    }

    const { orderId } = req.params;
    const recipientEmail = String(req.body?.email || "").trim();

    if (!recipientEmail) {
      return next({ statusCode: 400, message: "Recipient email is required." });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return next({ statusCode: 404, message: "Order not found." });
    }

    const result = await sendOrderCustomerPublicNew(order as any, {
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
