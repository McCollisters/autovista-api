import express from "express";
import { Portal } from "@/_global/models";

export const getPortals = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    res.status(200).json(await Portal.find({}));
  } catch (error) {
    next(error);
  }
};
