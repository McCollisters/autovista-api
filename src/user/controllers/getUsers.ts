import express from "express";
import { User } from "../schema";
import { Status } from "../../_global/enums";

export const getUsers = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
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

    const users = await User.find(filter);

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
};
