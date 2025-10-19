import express from "express";
import { Portal } from "@/_global/models";

export const deletePortal = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const deletedPortal = await Portal.findByIdAndDelete(req.params.quoteId);

    if (!deletedPortal) {
      return next({ statusCode: 404, message: "Portal not found." });
    }

    res.status(200).json({ quoteId: deletedPortal._id });
  } catch (error) {
    next(error);
  }
};
