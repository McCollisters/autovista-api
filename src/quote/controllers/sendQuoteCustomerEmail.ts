import express from "express";
import { Quote } from "@/_global/models";
import { sendQuoteEmailToCustomer } from "../services/sendQuoteEmailToCustomer";
import { logger } from "@/core/logger";

export const sendQuoteCustomerEmail = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { quoteId } = req.params;
    const recipientEmail = String(req.body?.email || "").trim();

    if (!recipientEmail) {
      return next({ statusCode: 400, message: "Recipient email is required." });
    }

    const quote = await Quote.findById(quoteId).lean();
    if (!quote) {
      return next({ statusCode: 404, message: "Quote not found." });
    }

    const result = await sendQuoteEmailToCustomer(quote, recipientEmail, {
      variant: "share",
    });

    if (!result.success) {
      return next({
        statusCode: 500,
        message: "Failed to send quote email.",
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Error sending customer quote email", {
      error: error instanceof Error ? error.message : String(error),
      quoteId: req.params?.quoteId,
    });
    next(error);
  }
};
