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
 * Generate a random 6-digit verification code
 */
function generateCode(): string {
  const min = 100000;
  const max = 999999;
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
    // In production on EB, working directory is /var/app/current/
    // Templates are in src/templates/ in the deployment package
    // Also copied to dist/templates/ during build
    // Try multiple path strategies to find the template
    const projectRoot = process.cwd();
    const possiblePaths = [
      join(projectRoot, "src/templates/verification-code.hbs"), // Standard path from project root
      join(__dirname, "../../templates/verification-code.hbs"), // From dist/auth/services (if templates copied to dist)
      join(__dirname, "../../../templates/verification-code.hbs"), // Alternative path
      join(__dirname, "../../../src/templates/verification-code.hbs"), // From dist/auth/services to src
      join(projectRoot, "templates/verification-code.hbs"), // If templates at root
    ];

    let templatePath: string | null = null;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        templatePath = path;
        break;
      }
    }

    let html: string;
    if (!templatePath) {
      // Log detailed error for debugging
      logger.error("Verification code template not found", {
        possiblePaths,
        cwd: projectRoot,
        dirname: __dirname,
        // Check what directories exist
        srcExists: existsSync(join(projectRoot, "src")),
        templatesExists: existsSync(join(projectRoot, "src/templates")),
        distExists: existsSync(join(projectRoot, "dist")),
      });
      html = `<p>Your verification code is <strong>${code}</strong>.</p>`;
    } else {
      logger.debug("Loading verification code template", { templatePath });

      const source = readFileSync(templatePath, "utf8");
      const template = Handlebars.compile(source);

      // Render template with code
      html = template({ code });
    }

    // Send email using notification manager
    const notificationManager = getNotificationManager();
    const result = await notificationManager.sendEmail({
      to: recipientEmail,
      from: senderEmail,
      subject,
      html,
      templateName: "Verification Code",
    });

    if (!result.success) {
      logger.error("Failed to send verification email", {
        recipientEmail,
        error: result.error,
      });
      throw new Error(result.error || "Failed to send verification email");
    }

    const codeSent = new Date();
    const codeExpires = new Date(Date.now() + 3600000); // 60 minutes (increased from 30)

    // Log code in development/test environments
    if (process.env.NODE_ENV !== "production") {
      logger.info("Verification code generated", {
        recipientEmail,
        code,
        codeSent: codeSent.toISOString(),
        codeExpires: codeExpires.toISOString(),
        expirationMinutes: 60,
      });
    } else {
      // In production, log without the code for security
      logger.info("Verification code sent", {
        recipientEmail,
        codeSent: codeSent.toISOString(),
        codeExpires: codeExpires.toISOString(),
        expirationMinutes: 60,
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
