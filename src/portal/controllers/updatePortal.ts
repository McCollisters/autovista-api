import express from "express";
import { Portal, ModifierSet } from "@/_global/models";

export const updatePortal = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { modifierSet, ...portalPayload } = req.body || {};

    const updatedPortal = await Portal.findByIdAndUpdate(
      req.params.portalId,
      portalPayload,
      {
        new: true,
      },
    );

    if (modifierSet?.portalId) {
      await ModifierSet.findOneAndUpdate(
        { portalId: modifierSet.portalId },
        { $set: modifierSet },
        { new: true, upsert: true },
      );
    }

    res.status(200).json(updatedPortal);
  } catch (error) {
    next(error);
  }
};
