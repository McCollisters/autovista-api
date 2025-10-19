import express from "express";
import { Survey } from "@/_global/models";

export const createSurvey = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  const savedSurvey = await new Survey({ brand: "Ford" }).save();
  res.send(savedSurvey);
};
