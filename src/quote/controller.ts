import express from "express";
import { Quote } from "./schema";

export const createQuote = async (req: express.Request, res: express.Response): Promise<void> => {
  const savedQuote = await new Quote({ brand: "Ford" }).save()
  res.send(savedQuote);
};