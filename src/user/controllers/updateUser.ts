import express from "express";
import { User } from "@/_global/models";

export const updateUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.quoteId,
      req.body,
      {
        new: true,
      },
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};
