import express from "express";
import { Settings } from "@/_global/models";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";

/**
 * PUT /settings
 * Update settings (MCAdmin only)
 */
export const updateSettings = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));

    if (!authUser || authUser.role !== "MCAdmin") {
      return next({
        statusCode: 401,
        message: "Unauthorized. MCAdmin access required.",
      });
    }

    // Find existing settings or create new
    let settings = await Settings.findOne();

    if (!settings) {
      settings = new Settings({});
    }

    // Update fields from request body
    const {
      transitTimes,
      holidays,
      quoteExpirationDays,
      serviceLevels,
    } = req.body;

    if (transitTimes !== undefined) {
      settings.transitTimes = transitTimes;
    }

    if (holidays !== undefined) {
      // Convert string dates to Date objects if needed
      settings.holidays = holidays.map((date: string | Date) =>
        typeof date === "string" ? new Date(date) : date,
      );
    }

    if (quoteExpirationDays !== undefined) {
      settings.quoteExpirationDays = quoteExpirationDays;
    }

    if (serviceLevels !== undefined) {
      settings.serviceLevels = serviceLevels;
    }

    // Update the updatedAt timestamp
    settings.updatedAt = new Date();

    await settings.save();

    logger.info(`User ${authUser.email} updated settings`, {
      userId: authUser._id,
      updatedFields: Object.keys(req.body),
    });

    res.status(200).json(settings);
  } catch (error) {
    logger.error("Error updating settings", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return next({
      statusCode: 500,
      message: "There was an error updating settings.",
    });
  }
};

