import express from "express";
import { Portal } from "./schema";
import { Status } from "../_global/enums";

export const createPortal = async (
  req: express.Request,
  res: express.Response,
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

export const updatePortal = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const updatedPortal = await Portal.findByIdAndUpdate(
      req.params.portalId,
      req.body,
      { new: true, runValidators: true },
    );

    if (!updatedPortal) {
      res.status(404).json({ message: "Portal not found" });
      return;
    }

    res.status(200).json(updatedPortal);
  } catch (error) {
    console.error("Error updating portal:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getPortal = async (
  req: express.Request,
  res: express.Response,
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

export const deletePortal = async (
  req: express.Request,
  res: express.Response,
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
