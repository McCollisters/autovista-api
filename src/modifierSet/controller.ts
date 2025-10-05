import express from "express";
import { ModifierSet } from "./schema";
import { Status } from "../_global/enums";

export const createModifierSet = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const modifierSet = { ...req.body, status: Status.Active };
    const createdModifierSet = await new ModifierSet(modifierSet).save();
    res.status(200).send(createdModifierSet);
  } catch (error) {
    console.error("Error creating modifierSet:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateModifierSet = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { modifierId } = req.params;

    const updatedModifierSet = await ModifierSet.findByIdAndUpdate(
      modifierId,
      req.body,
      { new: true, runValidators: true },
    ).lean();

    if (!updatedModifierSet) {
      res.status(404).json({ message: "ModifierSet not found" });
      return;
    }

    res.status(200).json(updatedModifierSet);
  } catch (error) {
    console.error("Error updating modifier set:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getModifierSet = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { modifierId } = req.params;

    const modifierSet = (await ModifierSet.findById(modifierId).lean()) as any;

    if (!modifierSet) {
      res.status(404).json({ message: "ModifierSet not found" });
      return;
    }

    res.status(200).json(modifierSet);
  } catch (error) {
    console.error("Error fetching modifier set:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteModifierSet = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { modifierId } = req.params;

    const updatedModifierSet = await ModifierSet.findByIdAndUpdate(
      modifierId,
      { status: Status.Archived },
      { new: true, runValidators: true },
    ).lean();

    if (!updatedModifierSet) {
      res.status(404).json({ message: "ModifierSet not found" });
      return;
    }

    res.status(200).json(updatedModifierSet);
  } catch (error) {
    console.error("Error deleting modifier set:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getModifierSets = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { portalId, role } = req.query;
    let filter: any = { status: Status.Active };

    if (portalId) {
      filter.portalId = portalId;
    }

    if (role) {
      filter.role = role;
    }

    // @ts-ignore
    const modifierSets = await ModifierSet.find(filter).lean();

    res.status(200).json(modifierSets);
  } catch (error) {
    console.error("Error fetching modifier sets:", error);
    res.status(500).json({ message: "Server error" });
  }
};
