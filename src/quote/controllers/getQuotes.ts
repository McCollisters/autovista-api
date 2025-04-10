import express from "express";
import { Quote } from "../schema";

export const getQuotes = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    res.status(200).send(await Quote.find({}));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
