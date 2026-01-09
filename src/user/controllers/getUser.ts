import express from "express";
import { User } from "@/_global/models";

export const getUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Prevent "me" from being treated as a user ID
    // The /me route should handle this, but this is a safety check
    if (userId === "me") {
      return next({
        statusCode: 404,
        message: "Use GET /api/v1/user/me to get the current user",
      });
    }

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
