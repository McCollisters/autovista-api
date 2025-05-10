import express from "express";
import { Quote } from "../schema";

export const getQuote = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { quoteId } = req.params;
    const quote = await Quote.findById(quoteId);

    if (!quote) {
      return next({ statusCode: 404, message: "Quote not found." });
    }

    res.status(200).json(quote);
  } catch (error) {
    next(error);
  }
};
