import express from "express";
import { Rule } from "./schema";

export const createRule = async (req: express.Request, res: express.Response): Promise<void> => {
  const savedRule = await new Rule({ brand: "Ford" }).save()
  res.send(savedRule);
};