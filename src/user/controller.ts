import express from "express";
import { User } from "./schema";
import { Status } from "../_global/enums";

export const createUser = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const user = { ...req.body, status: Status.Active };
    const createdUser = await new User(user).save();
    res.status(200).send(createdUser);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateUser = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { userId } = req.params;

    const updatedUser = await User.findByIdAndUpdate(userId, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUser = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteUser = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { userId } = req.params;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { status: Status.Archived },
      { new: true, runValidators: true },
    );

    if (!updatedUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUsers = async (
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

    const users = await User.find(filter);

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
};
