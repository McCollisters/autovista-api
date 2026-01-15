import express from "express";
import { Survey } from "@/_global/models";

export const createSurvey = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  const { question, isScale, order, hasExplanation } = req.body || {};
  const savedSurvey = await new Survey({
    question,
    isScale,
    order,
    hasExplanation,
  }).save();
  res.send(savedSurvey);
};
