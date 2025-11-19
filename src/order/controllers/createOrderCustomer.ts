import express from "express";
import { createOrder } from "./createOrder";
import { logger } from "@/core/logger";

/**
 * POST /api/v1/order/customer
 * Create order from customer (public endpoint)
 * 
 * This is a public endpoint that allows customers to create orders.
 * Uses the same createOrder logic but with isCustomerPortal flag.
 * The createOrder function already handles sending customer emails.
 */
export const createOrderCustomer = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { portalId } = req.body;

    if (!portalId) {
      return next({
        statusCode: 400,
        message: "Portal ID is required.",
      });
    }

    // Set isCustomerPortal flag in body
    req.body.isCustomerPortal = true;

    // Call the existing createOrder controller
    // It already handles customer email sending
    await createOrder(req, res, next);

    // Log customer order creation (createOrder already logs)
    logger.info("Public customer order creation attempted", {
      portalId,
    });
  } catch (error) {
    logger.error("Error creating customer order", {
      error: error instanceof Error ? error.message : error,
      portalId: req.body?.portalId,
    });
    next({
      statusCode: 500,
      message: "There was an error creating this order.",
    });
  }
};

