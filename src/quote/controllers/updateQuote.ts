import express from "express";
import { Quote } from "../schema";

export const updateQuote = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const updatedQuote = await Quote.findByIdAndUpdate(
      req.params.quoteId,
      req.body,
      {
        new: true,
      },
    );

    res.status(200).json(updatedQuote);
  } catch (error) {
    next(error);
  }
};
