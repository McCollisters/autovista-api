/**
 * Get Makes Controller
 *
 * Returns all vehicle makes and their models with pricing classes
 */

import express from "express";
import { Brand } from "@/_global/models";
import { logger } from "@/core/logger";

export const getMakes = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const makes = await Brand.find({}).sort({ make: 1 }).lean();

    logger.info("Makes retrieved successfully", {
      count: makes.length,
      sample: makes.length > 0 ? makes[0] : null,
    });

    if (makes.length === 0) {
      logger.warn("No makes found in database. Make sure brands have been migrated.");
    }

    res.status(200).json(makes);
  } catch (error) {
    logger.error("Error getting makes and models", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return next({
      statusCode: 500,
      message: "There was an error getting makes and models.",
    });
  }
};
