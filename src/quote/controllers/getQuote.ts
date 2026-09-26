import express from "express";
import { Quote, ModifierSet, Order } from "@/_global/models";
import { Status } from "@/_global/enums";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
import { respondIfDemo } from "@/demo/respondWithDemo";
import { getDemoQuoteById } from "@/demo/fixtures";

export const getQuote = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { quoteId } = req.params;

    if ((req as any).demoMode) {
      const demoQuote = getDemoQuoteById(quoteId);
      if (!demoQuote) {
        return next({ statusCode: 404, message: "Quote not found." });
      }
      if (respondIfDemo(req, res, demoQuote)) {
        return;
      }
    }

    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));

    const quote = await Quote.findById(quoteId)
      .populate("portal") // Populate portal to get portal info
      .populate("user", "firstName lastName") // Populate user to get booking agent info
      .lean();

    if (!quote) {
      return next({ statusCode: 404, message: "Quote not found." });
    }

    // If portal is populated, also fetch and attach its modifierSet
    if (
      quote.portal &&
      typeof quote.portal === "object" &&
      (quote.portal as any)._id
    ) {
      const portalId = (quote.portal as any)._id;
      const modifierSet = await ModifierSet.findOne({
        portal: portalId,
      }).lean();
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

    const statusLower = String((quote as any).status || "").toLowerCase();
    if (statusLower === Status.Booked) {
      (quote as any).isBooked = true;
      // Only expose internal order id to authenticated portal users.
      // Public/embed clients resolve via customer find (proof) or session.
      if (authUser) {
        const linkedOrder = await Order.findOne({ quoteId: (quote as any)._id })
          .select("_id")
          .lean();
        if (linkedOrder?._id) {
          (quote as any).bookedOrderId = String(linkedOrder._id);
        }
      }
    }

    res.status(200).json(quote);
  } catch (error) {
    next(error);
  }
};
