import express from "express";
import { ModifierSet } from "./schema";
import { Status } from "../_global/enums";

export const createModifierSet = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const rule = { ...req.body, status: Status.Active };
    const createdModifierSet = await new ModifierSet(rule).save();
    res.status(200).send(createdModifierSet);
  } catch (error) {
    console.error("Error creating rule:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateModifierSet = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { ruleId } = req.params;

    const updatedModifierSet = await ModifierSet.findByIdAndUpdate(
      ruleId,
      req.body,
      { new: true, runValidators: true },
    );

    if (!updatedModifierSet) {
      res.status(404).json({ message: "ModifierSet not found" });
      return;
    }

    res.status(200).json(updatedModifierSet);
  } catch (error) {
    console.error("Error updating rule:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getModifierSet = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { ruleId } = req.params;

    const rule = await ModifierSet.findById(ruleId);

    if (!rule) {
      res.status(404).json({ message: "ModifierSet not found" });
      return;
    }

    res.status(200).json(rule);
  } catch (error) {
    console.error("Error fetching rule:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteModifierSet = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { ruleId } = req.params;

    const updatedModifierSet = await ModifierSet.findByIdAndUpdate(
      ruleId,
      { status: Status.Archived },
      { new: true, runValidators: true },
    );

    if (!updatedModifierSet) {
      res.status(404).json({ message: "ModifierSet not found" });
      return;
    }

    res.status(200).json(updatedModifierSet);
  } catch (error) {
    console.error("Error deleting rule:", error);
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

    const rules = await ModifierSet.find(filter);

    res.status(200).json(rules);
  } catch (error) {
    console.error("Error fetching rules:", error);
    res.status(500).json({ message: "Server error" });
  }
};
