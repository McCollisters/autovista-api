import express from "express";
import { Quote, ModifierSet } from "@/_global/models";

export const getQuote = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { quoteId } = req.params;
    const quote = await Quote.findById(quoteId)
      .populate("portalId") // Populate portal to get portal info
      .populate("userId", "firstName lastName") // Populate user to get booking agent info
      .lean();

    if (!quote) {
      return next({ statusCode: 404, message: "Quote not found." });
    }

    // If portal is populated, also fetch and attach its modifierSet
    if (quote.portalId && typeof quote.portalId === 'object' && (quote.portalId as any)._id) {
      const portalId = (quote.portalId as any)._id;
      const modifierSet = await ModifierSet.findOne({ portalId }).lean();
      if (modifierSet) {
        (quote.portalId as any).modifierSet = modifierSet;
      }
    }

    res.status(200).json(quote);
  } catch (error) {
    next(error);
  }
};
