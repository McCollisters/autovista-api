import express from "express";
import { User } from "../schema";

export const deleteUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.quoteId);

    if (!deletedUser) {
      return next({ statusCode: 404, message: "User not found." });
    }

    res.status(200).json({ quoteId: deletedUser._id });
  } catch (error) {
    next(error);
  }
};
