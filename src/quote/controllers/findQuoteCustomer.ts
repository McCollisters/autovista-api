import express from "express";
import { Quote } from "@/_global/models";
import { logger } from "@/core/logger";

/**
 * POST /api/v1/quote/customer/find
 * Find quote by customer info
 * 
 * Body: { customerCode: string, customerLastName?: string, customerEmail?: string }
 * Finds quote by trackingCode (customerCode) and validates against lastName or email
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

    // Find quote by tracking code (customerCode)
    const quote = await Quote.findOne({
      "customer.trackingCode": customerCode,
    }).select("-portalId"); // Exclude portal from response

    if (!quote) {
      res.status(404).json({
        error: "Sorry, we could not find a quote with this confirmation code.",
      });
      return;
    }

    // Validate against lastName if provided
    if (customerLastName) {
      const quoteLastName = quote.customer?.name?.toLowerCase();
      if (quoteLastName && quoteLastName.includes(customerLastName)) {
        res.status(200).json(quote);
        return;
      } else {
        res.status(401).json({
          error:
            "Sorry, this confirmation code does not match the last name we have on file.",
        });
        return;
      }
    }

    // Validate against email if provided
    if (customerEmail) {
      const quoteEmail = quote.customer?.email?.toLowerCase();
      if (quoteEmail === customerEmail) {
        res.status(200).json(quote);
        return;
      } else {
        res.status(401).json({
          error:
            "Sorry, this confirmation code does not match the email we have on file.",
        });
        return;
      }
    }

    // If no validation provided, return quote anyway (public access)
    res.status(200).json(quote);
  } catch (error) {
    logger.error("Error finding quote by customer", {
      error: error instanceof Error ? error.message : error,
      customerCode: req.body?.customerCode,
    });
    next(error);
  }
};

