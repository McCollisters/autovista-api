import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";
import { logger } from "@/core/logger";
import { getNotificationManager } from "@/notification";
import { createToken } from "@/_global/utils/createToken";
import type { IUser } from "@/user/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_EMAIL_INTRO =
  "<p>Welcome to the AutoVista Portal. An account has been created for you.</p>";
const DEFAULT_EMAIL_BODY =
  "<p>If you need help, contact us at autologistics@mccollisters.com.</p>";

/**
 * Sends the new-user welcome email with a password-setup link. On success,
 * persists reset token fields on the user (same pattern as forgot password).
 */
export async function sendNewUserWelcomeEmail(user: IUser): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const token = createToken(user);
    const resetPasswordExpires = new Date(Date.now() + 3600000);

    const projectRoot = process.cwd();
    const possiblePaths = [
      join(projectRoot, "src/templates/new-user.hbs"),
      join(__dirname, "../../templates/new-user.hbs"),
      join(__dirname, "../../../templates/new-user.hbs"),
      join(__dirname, "../../../src/templates/new-user.hbs"),
      join(projectRoot, "templates/new-user.hbs"),
    ];

    let templatePath: string | null = null;
    for (const p of possiblePaths) {
      if (existsSync(p)) {
        templatePath = p;
        break;
      }
    }

    const firstName = user.firstName || "User";
    let html: string;

    if (!templatePath) {
      logger.error("new-user template not found", { possiblePaths });
      const resetUrl = `https://autovista.mccollisters.com/reset-password/${token}`;
      html = `<p>Hi ${firstName},</p><p>Welcome to AutoVista.</p><p><a href="${resetUrl}">Set your password</a></p>`;
    } else {
      const source = readFileSync(templatePath, "utf8");
      const template = Handlebars.compile(source);
      html = template({
        firstName,
        emailIntro: DEFAULT_EMAIL_INTRO,
        emailBody: DEFAULT_EMAIL_BODY,
        token,
      });
    }

    const notificationManager = getNotificationManager();
    const result = await notificationManager.sendEmail({
      to: user.email,
      from: "autologistics@mccollisters.com",
      subject: "Welcome to the AutoVista Portal",
      html,
      templateName: "New User",
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    user.resetPasswordToken = token;
    user.resetPasswordExpires = resetPasswordExpires;
    await user.save();

    logger.info("Welcome email sent for new user", {
      email: user.email,
      userId: user._id,
    });

    return { success: true };
  } catch (error) {
    logger.error("Error sending welcome email", {
      error: error instanceof Error ? error.message : error,
      email: user.email,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
