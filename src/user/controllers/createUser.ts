import express from "express";
import { User } from "../schema";
import { Status } from "../../_global/enums";

export const createUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const portal = { ...req.body, status: Status.Active };
    const createdUser = await new User(portal).save();
    res.status(200).send(createdUser);
  } catch (error) {
    console.error("Error creating portal:", error);
    res.status(500).json({ message: "Server error" });
  }
};
