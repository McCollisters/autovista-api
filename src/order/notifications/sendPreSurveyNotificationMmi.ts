/**
 * Send Pre-Survey Notification MMI (Graebel/MMI)
 *
 * Sends the MMI pre-survey notification to customers (instead of the standard survey).
 * Used by the survey cron for portals in MMI_PORTALS. Template: mmi-pre-survey-notification.hbs.
 */

import { logger } from "@/core/logger";
import { Order } from "@/_global/models";
import { sendOrderNotification } from "@/notification/orderNotifications";
import { join } from "path";
import { readFile } from "fs/promises";
import Handlebars from "handlebars";
import { resolveTemplatePath } from "./utils/resolveTemplatePath";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SendPreSurveyNotificationMmiParams {
  orderId: string;
  recipientEmail?: string;
  recipientName?: string;
}

/**
 * Send pre-survey notification MMI (MMI/Graebel: "McCollister's Values your Opinion")
 */
export async function sendPreSurveyNotificationMmi({
  orderId,
  recipientEmail: overrideRecipientEmail,
  recipientName: overrideRecipientName,
}: SendPreSurveyNotificationMmiParams): Promise<{ success: boolean; error?: string }> {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return { success: false, error: "Order not found." };
    }

    const recipientEmail = overrideRecipientEmail || order.customer?.email;
    const recipientName =
      overrideRecipientName || order.customer?.name;

    if (!recipientEmail) {
      logger.warn(
        `Cannot send pre-survey notification MMI: No recipient email for order ${orderId}`,
      );
      return { success: false, error: "Recipient email is required." };
    }

    const { getEmailTemplate } = await import("@/email/services/getEmailTemplate");
    const emailTemplate = await getEmailTemplate("Survey");
    const senderEmail = emailTemplate.senderEmail || "autologistics@mccollisters.com";
    const senderName = emailTemplate.senderName || "McCollister's AutoLogistics";
    const subject = "McCollister's Values your Opinion";

    const templatePath = join(
      __dirname,
      "../../templates/mmi-pre-survey-notification.hbs",
    );
    const resolvedTemplatePath = await resolveTemplatePath(
      templatePath,
      join(process.cwd(), "src/templates/mmi-pre-survey-notification.hbs"),
    );
    const templateSource = await readFile(resolvedTemplatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    const htmlContent = template({
      recipientName: recipientName || "Customer",
    });

    const result = await sendOrderNotification({
      orderId,
      type: "surveyReminder",
      email: {
        to: recipientEmail,
        subject,
        html: htmlContent,
        from: senderEmail,
        fromName: senderName,
        replyTo: senderEmail,
      },
      recipientEmail,
    });

    if (result.success) {
      logger.info("Pre-survey notification MMI sent successfully", {
        orderId,
        refId: order.refId,
        recipientEmail,
      });
      return { success: true };
    } else {
      logger.error("Failed to send pre-survey notification MMI", {
        orderId,
        refId: order.refId,
        recipientEmail,
      });
      return { success: false, error: "Failed to send pre-survey notification MMI." };
    }
  } catch (error) {
    logger.error(`Error sending pre-survey notification MMI for order ${orderId}:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { success: false, error: "Failed to send pre-survey notification MMI." };
  }
}
