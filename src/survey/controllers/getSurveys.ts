import express from "express";
import { Survey } from "@/_global/models";

/**
 * GET /api/v1/surveys
 * Get all surveys
 */
export const getSurveys = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const surveys = await Survey.find({}).sort({ createdAt: -1 });
    res.status(200).json(surveys);
  } catch (error) {
    next(error);
  }
};
