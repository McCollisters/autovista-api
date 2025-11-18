import express from "express";
import { Settings } from "@/_global/models";
import { logger } from "@/core/logger";

/**
 * GET /settings
 * Get global settings (admin only)
 */
export const getSettings = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const settings = await Settings.findOne();

    if (!settings) {
      return next({
        statusCode: 404,
        message: "Settings not found.",
      });
    }

    res.status(200).json(settings);
  } catch (error) {
    logger.error("Error getting settings", {
      error: error instanceof Error ? error.message : error,
    });

    return next({
      statusCode: 500,
      message: "There was an error getting settings.",
    });
  }
};

