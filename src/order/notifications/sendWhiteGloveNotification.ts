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

interface SendWhiteGloveNotificationParams {
  order: IOrder;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Send white glove notification to CSR team
 */
export const sendWhiteGloveNotification = async (
  params: SendWhiteGloveNotificationParams,
): Promise<void> => {
  try {
    const { order } = params;

    logger.info("Sending white glove notification", {
      orderId: order._id,
      uniqueId: order.refId,
    });

    const senderEmail = "autologistics@mccollisters.com";
    const senderName = "McCollister's AutoLogistics";
    const subject = `White Glove Order - Manual Input: #${order.refId}`;
    const recipientEmail = "autologistics.csr@mccollisters.com";

    // Load and compile Handlebars template
    const templatePath = join(__dirname, "../../templates/white-glove.hbs");
    const templateSource = await readFile(templatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    // Prepare template data
    const html = template({
      uniqueId: order.refId,
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
    });

    if (result.success) {
      logger.info("White glove notification sent successfully", {
        orderId: order._id,
        uniqueId: order.refId,
        recipientEmail,
      });
    } else {
      logger.error("Failed to send white glove notification", {
        orderId: order._id,
        uniqueId: order.refId,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error("Error sending white glove notification:", error);
    // Don't throw - notification failures shouldn't break order creation
  }
};
