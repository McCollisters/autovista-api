import express from "express";
import { Settings, Brand } from "@/_global/models";
import { logger } from "@/core/logger";

/**
 * GET /settings/customer
 * Get customer-facing settings (public endpoint)
 * Returns service levels, holidays, and makes (brands)
 */
export const getCustomerSettings = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const settings = await Settings.findOne();
    const makes = await Brand.find({}).sort({ make: 1 });

    if (!settings) {
      return next({
        statusCode: 404,
        message: "Settings not found.",
      });
    }

    const customerSettings = {
      makes: makes.map((make) => ({
        _id: make._id,
        make: make.make,
        models: make.models || [],
      })),
      serviceLevels: settings.serviceLevels || [],
      holidays: settings.holidays || [],
    };

    res.status(200).json(customerSettings);
  } catch (error) {
    logger.error("Error getting customer settings", {
      error: error instanceof Error ? error.message : error,
    });

    return next({
      statusCode: 500,
      message: "There was an error getting customer settings.",
    });
  }
};

