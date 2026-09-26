import express from "express";
import { Portal } from "@/_global/models";
import { rejectDemoMutation } from "@/demo/respondWithDemo";

export const deletePortal = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    if (rejectDemoMutation(req, next)) {
      return;
    }

    const deletedPortal = await Portal.findByIdAndDelete(req.params.portalId);

    if (!deletedPortal) {
      return next({ statusCode: 404, message: "Portal not found." });
    }

    res.status(200).json({ portalId: deletedPortal._id });
  } catch (error) {
    next(error);
  }
};
