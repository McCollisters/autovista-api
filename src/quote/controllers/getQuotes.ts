import express from "express";
import { Quote } from "@/_global/models";

export const getQuotes = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    res.status(200).json(await Quote.find({}));
  } catch (error) {
    next(error);
  }
};
