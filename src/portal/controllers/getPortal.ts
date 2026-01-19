import express from "express";
import { Portal, ModifierSet } from "@/_global/models";

export const getPortal = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { portalId } = req.params;

    const portal = await Portal.findById(portalId).lean();

    if (!portal) {
      res.status(404).json({ message: "Portal not found" });
      return;
    }

    const modifierSet = await ModifierSet.findOne({ portal: portal._id })
      .select(
        "portal companyTariff companyTariffEnclosedFee companyTariffDiscount discount whiteGlove fuel irr oversize enclosed portalWideCommission",
      )
      .lean();

    res.status(200).json({
      ...portal,
      modifierSet: modifierSet || null,
    });
  } catch (error) {
    console.error("Error fetching portal:", error);
    res.status(500).json({ message: "Server error" });
  }
};
