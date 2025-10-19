import express from "express";
import { Portal } from "@/_global/models";
import { Status } from "../../_global/enums";

export const createPortal = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const portal = { ...req.body, status: Status.Active };
    const createdPortal = await new Portal(portal).save();
    res.status(200).send(createdPortal);
  } catch (error) {
    console.error("Error creating portal:", error);
    res.status(500).json({ message: "Server error" });
  }
};
