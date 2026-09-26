import express from "express";
import { Quote, Order } from "@/_global/models";
import { logger } from "@/core/logger";
import { customerLastNameMatches } from "@/_global/utils/customerLastName";
import { Status } from "@/_global/enums";

/**
 * POST /api/v1/quote/customer/find
 * Find quote by customer info
 *
 * Body: { customerCode: string, customerLastName?: string, customerEmail?: string }
 * Finds quote by confirmation/tracking code and requires email or lastName validation.
 */
export const findQuoteCustomer = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    let { customerCode, customerLastName, customerEmail } = req.body;

    if (!customerCode) {
      return next({
        statusCode: 400,
        message: "Customer code is required.",
      });
    }

    customerCode = customerCode.toUpperCase().trim();
    customerLastName = customerLastName?.toLowerCase().trim() || null;
    customerEmail = customerEmail?.toLowerCase().trim() || null;

    if (!customerLastName && !customerEmail) {
      return next({
        statusCode: 400,
        message: "Email or last name is required.",
      });
    }

    // Find quote by confirmation code (customerCode)
    const quote = await Quote.findOne({
      $or: [
        { "customer.quoteConfirmationCode": customerCode },
        { "customer.trackingCode": customerCode },
      ],
    }).select("-portal"); // Exclude portal from response

    if (!quote) {
      res.status(404).json({
        error: "Sorry, we could not find a quote with this confirmation code.",
      });
      return;
    }

    let authorized = false;

    if (customerLastName) {
      if (customerLastNameMatches(quote.customer, customerLastName)) {
        authorized = true;
      } else {
        res.status(401).json({
          error:
            "Sorry, this confirmation code does not match the last name we have on file.",
        });
        return;
      }
    }

    if (!authorized) {
      const quoteEmail = quote.customer?.email?.toLowerCase();
      if (quoteEmail === customerEmail) {
        authorized = true;
      } else {
        res.status(401).json({
          error:
            "Sorry, this confirmation code does not match the email we have on file.",
        });
        return;
      }
    }

    const quoteObj = quote.toObject ? quote.toObject() : { ...quote };
    const statusLower = String((quoteObj as any).status || "").toLowerCase();
    if (statusLower === Status.Booked) {
      const linkedOrder = await Order.findOne({ quoteId: (quoteObj as any)._id })
        .select("_id")
        .lean();
      if (linkedOrder?._id) {
        (quoteObj as any).bookedOrderId = String(linkedOrder._id);
      }
      (quoteObj as any).isBooked = true;
    }

    res.status(200).json(quoteObj);
  } catch (error) {
    logger.error("Error finding quote by customer", {
      error: error instanceof Error ? error.message : error,
      customerCode: req.body?.customerCode,
    });
    next(error);
  }
};
