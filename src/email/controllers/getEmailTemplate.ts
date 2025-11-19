import express from "express";
import { EmailTemplate } from "@/_global/models";
import { logger } from "@/core/logger";

/**
 * GET /api/v1/emails/:templateId
 * Get a specific email template by ID
 */
export const getEmailTemplate = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { templateId } = req.params;

    const template = await EmailTemplate.findById(templateId);

    if (!template) {
      return next({
        statusCode: 404,
        message: "Email template not found.",
      });
    }

    res.status(200).json(template);
  } catch (error) {
    logger.error("Error getting email template", {
      error: error instanceof Error ? error.message : error,
      templateId: req.params.templateId,
    });
    next({
      statusCode: 500,
      message: "There was an error getting the email template.",
    });
  }
};

