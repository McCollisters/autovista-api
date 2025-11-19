/**
 * Get Email Template Service
 * 
 * Retrieves email template by name with fallback to defaults
 */

import { EmailTemplate } from "@/_global/models";
import { logger } from "@/core/logger";

const DEFAULT_SENDER_EMAIL = "autologistics@mccollisters.com";
const DEFAULT_SENDER_NAME = "McCollister's AutoLogistics";

export interface EmailTemplateValues {
  subject?: string;
  senderEmail: string;
  senderName: string;
  emailHeader?: string;
  emailIntro?: string;
  emailBody?: string;
  emailFooter?: string;
}

/**
 * Get email template by name
 * Returns template values with defaults if template not found
 */
export const getEmailTemplate = async (
  templateName: string,
): Promise<EmailTemplateValues> => {
  try {
    const template = await EmailTemplate.findOne({ templateName });

    if (!template) {
      logger.warn(`Email template not found: ${templateName}, using defaults`);
      return {
        senderEmail: DEFAULT_SENDER_EMAIL,
        senderName: DEFAULT_SENDER_NAME,
      };
    }

    return {
      subject: template.subject,
      senderEmail: template.senderEmail || DEFAULT_SENDER_EMAIL,
      senderName: template.senderName || DEFAULT_SENDER_NAME,
      emailHeader: template.emailHeader,
      emailIntro: template.emailIntro,
      emailBody: template.emailBody,
      emailFooter: template.emailFooter,
    };
  } catch (error) {
    logger.error("Error getting email template", {
      error: error instanceof Error ? error.message : error,
      templateName,
    });
    // Return defaults on error
    return {
      senderEmail: DEFAULT_SENDER_EMAIL,
      senderName: DEFAULT_SENDER_NAME,
    };
  }
};

