/**
 * Send White Glove Notification Service
 *
 * Sends notification to CSR team when a white glove order is created
 */

import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";
import { logger } from "@/core/logger";
import { IOrder } from "@/_global/models";
import { getNotificationManager } from "@/notification";
import { resolveTemplatePath } from "./utils/resolveTemplatePath";

interface SendWhiteGloveNotificationParams {
  order: IOrder;
  recipientEmail?: string;
  recipientName?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Send white glove notification to CSR team
 */
export const sendWhiteGloveNotification = async (
  params: SendWhiteGloveNotificationParams,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { order, recipientEmail: customRecipientEmail, recipientName } = params;

    logger.info("Sending white glove notification", {
      orderId: order._id,
      refId: order.refId,
      recipientEmail: customRecipientEmail,
    });

    const senderEmail = "autologistics@mccollisters.com";
    const senderName = "McCollister's AutoLogistics";
    const subject = `White Glove Order - Manual Input: #${order.refId}`;
    // Use custom recipient email if provided, otherwise default to CSR team
    const recipientEmail = customRecipientEmail || "autologistics.csr@mccollisters.com";

    // Load and compile Handlebars template
    const templatePath = join(__dirname, "../../templates/white-glove.hbs");
    const resolvedTemplatePath = await resolveTemplatePath(
      templatePath,
      join(process.cwd(), "src/templates/white-glove.hbs"),
    );
    const templateSource = await readFile(resolvedTemplatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    // Prepare template data
    const html = template({
      refId: order.refId,
      id: String(order._id),
    });

    // Send email using notification manager
    const notificationManager = getNotificationManager();
    const result = await notificationManager.sendEmail({
      to: recipientEmail,
      from: senderEmail,
      subject,
      html,
      replyTo: senderEmail,
      templateName: "White Glove Notification",
    });

    if (result.success) {
      logger.info("White glove notification sent successfully", {
        orderId: order._id,
        refId: order.refId,
        recipientEmail,
      });
      return { success: true };
    } else {
      logger.error("Failed to send white glove notification", {
        orderId: order._id,
        refId: order.refId,
        error: result.error,
      });
      return {
        success: false,
        error: result.error || "Failed to send white glove notification",
      };
    }
  } catch (error) {
    logger.error("Error sending white glove notification:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
