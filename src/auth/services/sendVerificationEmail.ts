/**
 * Send Verification Email Service
 *
 * Sends a verification code email to users for 2FA authentication
 */

import { logger } from "@/core/logger";
import { getNotificationManager } from "@/notification";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generate a random 5-digit verification code
 */
function generateCode(): string {
  const min = 10000;
  const max = 99999;
  const randomDecimal = Math.random();
  const randomInRange = Math.floor(randomDecimal * (max - min + 1)) + min;
  return randomInRange.toString();
}

/**
 * Send verification code email to user
 * @param recipientEmail - Email address to send verification code to
 * @returns Object containing the code, codeSent timestamp, and codeExpires timestamp
 */
export async function sendVerificationEmail(recipientEmail: string): Promise<{
  code: string;
  codeSent: Date;
  codeExpires: Date;
}> {
  try {
    const senderEmail = "autologistics@mccollisters.com";
    const senderName = "McCollister's AutoLogistics";
    const subject = "Your Autovista verification code";
    const code = generateCode();

    // Load and compile Handlebars template
    // In production, templates are in src/templates/ (not copied to dist)
    // Use process.cwd() to get project root and look for templates there
    const projectRoot = process.cwd();
    const templatePath = join(projectRoot, "src/templates/verification-code.hbs");

    if (!existsSync(templatePath)) {
      logger.error("Verification code template not found", {
        templatePath,
        cwd: projectRoot,
        dirname: __dirname,
      });
      throw new Error(`Verification code template not found at: ${templatePath}`);
    }

    const source = readFileSync(templatePath, "utf8");
    const template = Handlebars.compile(source);

    // Render template with code
    const html = template({ code });

    // Send email using notification manager
    const notificationManager = getNotificationManager();
    const result = await notificationManager.sendEmail({
      to: recipientEmail,
      from: senderEmail,
      subject,
      html,
    });

    if (!result.success) {
      logger.error("Failed to send verification email", {
        recipientEmail,
        error: result.error,
      });
      throw new Error(result.error || "Failed to send verification email");
    }

    const codeSent = new Date();
    const codeExpires = new Date(Date.now() + 1800000); // 30 minutes

    // Log code in development/test environments
    if (process.env.NODE_ENV !== "production") {
      logger.info("Verification code generated", {
        recipientEmail,
        code,
        codeExpires: codeExpires.toISOString(),
      });
    }

    return {
      code,
      codeSent,
      codeExpires,
    };
  } catch (error) {
    logger.error("Error sending verification email", {
      recipientEmail,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      templatePath: templatePath || "unknown",
    });
    throw error;
  }
}
