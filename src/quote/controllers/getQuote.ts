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
      .populate("portal") // Populate portal to get portal info
      .populate("user", "firstName lastName") // Populate user to get booking agent info
      .lean();

    if (!quote) {
      return next({ statusCode: 404, message: "Quote not found." });
    }

    // If portal is populated, also fetch and attach its modifierSet
    if (quote.portal && typeof quote.portal === "object" && (quote.portal as any)._id) {
      const portalId = (quote.portal as any)._id;
      const modifierSet = await ModifierSet.findOne({ portalId }).lean();
      if (modifierSet) {
        (quote.portal as any).modifierSet = modifierSet;
      }
    }

    if (quote && (quote as any).portal && !(quote as any).portalId) {
      (quote as any).portalId = (quote as any).portal;
    }
    if (quote && (quote as any).user && !(quote as any).userId) {
      (quote as any).userId = (quote as any).user;
    }

    res.status(200).json(quote);
  } catch (error) {
    next(error);
  }
};
