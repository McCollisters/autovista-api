import express from "express";
import { Portal } from "@/_global/models";

export const getPortal = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { portalId } = req.params;

    const portal = await Portal.findById(portalId);

    if (!portal) {
      res.status(404).json({ message: "Portal not found" });
      return;
    }

    res.status(200).json(portal);
  } catch (error) {
    console.error("Error fetching portal:", error);
    res.status(500).json({ message: "Server error" });
  }
};
