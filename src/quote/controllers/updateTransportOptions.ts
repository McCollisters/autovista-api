import express from "express";
import { Quote } from "@/_global/models";
import { TransportType } from "../../_global/enums";
import { recalculateExistingQuote } from "../services/recalculateExistingQuote";
import { logger } from "@/core/logger";

/**
 * POST /api/v1/quote/transport
 * Update transport options and recalculate quote
 * 
 * Body: { transportType: TransportType, quoteId: string }
 * Recalculates quote rates based on new transport type
 */
export const updateTransportOptions = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { transportType, quoteId } = req.body;

    if (!quoteId) {
      return next({
        statusCode: 400,
        message: "Quote ID is required.",
      });
    }

    if (!transportType) {
      return next({
        statusCode: 400,
        message: "Transport type is required.",
      });
    }

    // Validate transport type
    if (!Object.values(TransportType).includes(transportType)) {
      return next({
        statusCode: 400,
        message: "Invalid transport type.",
      });
    }

    // Recalculate quote
    const quote = await recalculateExistingQuote(quoteId, transportType);

    if (!quote) {
      return next({
        statusCode: 500,
        message: "There was an error calculating this quote.",
      });
    }

    res.status(200).json(quote);
  } catch (error) {
    logger.error("Error updating transport options", {
      error: error instanceof Error ? error.message : error,
      quoteId: req.body?.quoteId,
      transportType: req.body?.transportType,
    });
    next({
      statusCode: 500,
      message: "There was an error calculating this quote.",
    });
  }
};

