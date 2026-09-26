import express from "express";
import { Portal, ModifierSet } from "@/_global/models";
import { rejectDemoMutation } from "@/demo/respondWithDemo";

export const updatePortal = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    if (rejectDemoMutation(req, next)) {
      return;
    }

    const { modifierSet, ...portalPayload } = req.body || {};

    const updatedPortal = await Portal.findByIdAndUpdate(
      req.params.portalId,
      portalPayload,
      {
        new: true,
      },
    );

    if (modifierSet?.portal) {
      await ModifierSet.findOneAndUpdate(
        { portal: modifierSet.portal },
        { $set: modifierSet },
        { new: true, upsert: true },
      );
    }

    res.status(200).json(updatedPortal);
  } catch (error) {
    next(error);
  }
};
