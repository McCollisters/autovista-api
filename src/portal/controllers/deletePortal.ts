import express from "express";
import { Portal } from "../../portal/schema";
import { Status } from "../../_global/enums";

export const deletePortal = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { portalId } = req.params;

    const updatedPortal = await Portal.findByIdAndUpdate(
      portalId,
      { status: Status.Archived },
      { new: true, runValidators: true },
    );

    if (!updatedPortal) {
      res.status(404).json({ message: "Portal not found" });
      return;
    }

    res.status(200).json(updatedPortal);
  } catch (error) {
    console.error("Error deleting portal:", error);
    res.status(500).json({ message: "Server error" });
  }
};
