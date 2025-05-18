import express from "express";
import { Portal } from "../schema";

export const updatePortal = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const updatedPortal = await Portal.findByIdAndUpdate(
      req.params.quoteId,
      req.body,
      {
        new: true,
      },
    );

    res.status(200).json(updatedPortal);
  } catch (error) {
    next(error);
  }
};
