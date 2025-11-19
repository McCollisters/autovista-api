import express from "express";
import { EmailTemplate } from "@/_global/models";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";

/**
 * PUT /api/v1/emails/:templateId
 * Update an email template
 * 
 * Requires MCAdmin or Admin role
 */
export const updateEmailTemplate = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { templateId } = req.params;
    const authHeader = req.headers.authorization;
    const user = (req as any).user ?? (await getUserFromToken(authHeader));

    // Check authorization - MCAdmin or Admin only
    if (!user || (user.role !== "MCAdmin" && user.role !== "Admin")) {
      return next({
        statusCode: 403,
        message: "Forbidden: Admin access required",
      });
    }

    const template = await EmailTemplate.findById(templateId);

    if (!template) {
      return next({
        statusCode: 404,
        message: "Email template not found.",
      });
    }

    // Update allowed fields
    const allowedFields = [
      "subject",
      "senderEmail",
      "senderName",
      "emailHeader",
      "emailIntro",
      "emailBody",
      "emailFooter",
      "showInPortal",
      "mcOnly",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        (template as any)[field] = req.body[field];
      }
    }

    // Update lastUpdated will be handled by pre-save hook
    await template.save();

    logger.info("Email template updated", {
      templateId: template._id,
      templateName: template.templateName,
      updatedBy: user.email,
    });

    res.status(200).json(template);
  } catch (error) {
    logger.error("Error updating email template", {
      error: error instanceof Error ? error.message : error,
      templateId: req.params.templateId,
    });
    next({
      statusCode: 500,
      message: "There was an error updating the email template.",
    });
  }
};

