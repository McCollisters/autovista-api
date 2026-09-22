import express from "express";
import { Order, Portal, type IOrder } from "@/_global/models";
import { sendOrderCustomerPublicNew } from "../notifications/sendOrderCustomerPublicNew";
import { logger } from "@/core/logger";
import { resolveOrderCustomerEmailForTracking } from "../utils/resolveOrderCustomerEmailForTracking";

/**
 * POST /api/v1/order/:orderId/customer-share-email
 * Public: send order confirmation email to a recipient. Validates the same email + order
 * pair as GET order status (customer tracking).
 *
 * Body: { email: string, recipientEmail: string }
 */
export const sendOrderCustomerShareEmail = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const orderIdParam = req.params.orderId;
    const email = String(req.body?.email || "").trim();
    const recipientEmail = String(req.body?.recipientEmail || "").trim();

    if (!orderIdParam) {
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
    if (!recipientEmail) {
      return next({
        statusCode: 400,
        message: "Recipient email is required.",
      });
    }

    let order;
    if (orderIdParam.length < 7) {
      order = await Order.findOne({ refId: parseInt(orderIdParam, 10) }).lean();
    } else {
      order = await Order.findById(orderIdParam).lean();
    }

    if (!order) {
      return next({
        statusCode: 404,
        message: "Sorry, we could not find this order.",
      });
    }

    const portal = await Portal.findById(order.portalId);
    if (portal && (portal as { allowsCustomerTracking?: boolean }).allowsCustomerTracking === false) {
      return next({
        statusCode: 403,
        message: "Sorry, this order is not available for status tracking.",
      });
    }

    const customerEmail = resolveOrderCustomerEmailForTracking(order);
    const requestEmail = String(email || "").trim().toLowerCase();
    if (!customerEmail || customerEmail !== requestEmail) {
      return next({
        statusCode: 403,
        message:
          "You do not have permission to access this order. If you believe this is in error, please contact us for assistance.",
      });
    }

    const result = await sendOrderCustomerPublicNew(order as unknown as IOrder, {
      recipientEmail,
      variant: "share",
    });

    if (!result.success) {
      return next({
        statusCode: 500,
        message: result.error || "Failed to send email.",
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Error sending customer order share email", {
      error: error instanceof Error ? error.message : String(error),
      orderId: req.params?.orderId,
    });
    next(error);
  }
};
