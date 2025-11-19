import express from "express";
import { EmailTemplate } from "@/_global/models";
import { logger } from "@/core/logger";

/**
 * GET /api/v1/emails
 * Get all email templates
 */
export const getEmailTemplates = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const templates = await EmailTemplate.find({}).sort({ templateName: 1 });
    res.status(200).json(templates);
  } catch (error) {
    logger.error("Error getting email templates", {
      error: error instanceof Error ? error.message : error,
    });
    next({
      statusCode: 500,
      message: "There was an error getting the email list.",
    });
  }
};

