import express from "express";
import { Quote } from "@/_global/models";

export const deleteQuote = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const deletedQuote = await Quote.findByIdAndDelete(req.params.quoteId);

    if (!deletedQuote) {
      return next({ statusCode: 404, message: "Quote not found." });
    }

    res.status(200).json({ quoteId: deletedQuote._id });
  } catch (error) {
    next(error);
  }
};
