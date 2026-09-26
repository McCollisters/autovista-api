import express from "express";
import { Portal, ModifierSet } from "@/_global/models";
import { Status } from "../../_global/enums";
import { rejectDemoMutation } from "@/demo/respondWithDemo";

export const createPortal = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    if (rejectDemoMutation(req, next)) {
      return;
    }

    const { modifierSet, ...portalPayload } = req.body || {};
    const portal = { ...portalPayload, status: Status.Active };
    const createdPortal = await new Portal(portal).save();

    if (modifierSet) {
      await new ModifierSet({
        ...modifierSet,
        portal: createdPortal._id,
      }).save();
    }

    res.status(200).send(createdPortal);
  } catch (error) {
    console.error("Error creating portal:", error);
    res.status(500).json({ message: "Server error" });
  }
};
