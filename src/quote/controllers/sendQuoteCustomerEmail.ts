import express from "express";
import { Quote } from "@/_global/models";
import { sendQuoteEmailToCustomer } from "../services/sendQuoteEmailToCustomer";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
import { rejectDemoMutation } from "@/demo/respondWithDemo";

/**
 * POST /api/v1/quote/:quoteId/email
 * Authenticated portal users may share freely.
 * Unauthenticated callers must prove quote ownership with confirmation code + email.
 */
export const sendQuoteCustomerEmail = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    if (rejectDemoMutation(req, next)) {
      return;
    }

    const { quoteId } = req.params;
    const recipientEmail = String(req.body?.email || "").trim();
    const customerEmail = String(req.body?.customerEmail || "")
      .trim()
      .toLowerCase();
    const customerCode = String(req.body?.customerCode || "")
      .trim()
      .toUpperCase();

    if (!recipientEmail) {
      return next({ statusCode: 400, message: "Recipient email is required." });
    }

    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));

    const quote = await Quote.findById(quoteId).lean();
    if (!quote) {
      return next({ statusCode: 404, message: "Quote not found." });
    }

    if (!authUser) {
      if (!customerEmail || !customerCode) {
        return next({
          statusCode: 401,
          message:
            "Confirmation code and customer email are required to share this quote.",
        });
      }

      const quoteEmail = String(quote.customer?.email || "")
        .trim()
        .toLowerCase();
      const expectedCode = String(
        quote.customer?.quoteConfirmationCode ||
          quote.customer?.trackingCode ||
          "",
      )
        .trim()
        .toUpperCase();

      if (
        !quoteEmail ||
        quoteEmail !== customerEmail ||
        !expectedCode ||
        expectedCode !== customerCode
      ) {
        return next({
          statusCode: 403,
          message: "You do not have permission to share this quote.",
        });
      }
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
