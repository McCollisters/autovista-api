/**
 * Send Track Order Notification
 *
 * This service sends a notification when someone requests to track an order.
 * Sends to internal team (autologistics@mccollisters.com) when tracking is requested.
 */

import { logger } from "@/core/logger";
import { IOrder } from "@/_global/models";
import { getNotificationManager } from "@/notification";
import { join } from "path";
import { readFile } from "fs/promises";
import Handlebars from "handlebars";

// __dirname and __filename are available in CommonJS modules

interface SendTrackOrderNotificationParams {
  order: IOrder;
  recipientEmail?: string; // Optional: defaults to internal team
}

/**
 * Send track order notification
 * By default, sends to internal team. Can be customized to send to customer.
 */
export async function sendTrackOrderNotification({
  order,
  recipientEmail,
}: SendTrackOrderNotificationParams): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!order) {
    return { success: false, error: "Order object is required." };
  }

  try {
    const senderEmail = "autologistics@mccollisters.com";
    const senderName = "McCollister's AutoLogistics";
    const subject = `Tracking Request for Order #${order.refId}`;
    const toEmail = recipientEmail || "autologistics@mccollisters.com"; // Default to internal team

    // Load and compile Handlebars template
    const templatePath = join(
      __dirname,
      "../../../templates/track-order-notification.hbs",
    );
    const templateSource = await readFile(templatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    // Prepare template data
    const html = template({
      uniqueId: order.refId,
      id: String(order._id),
      transportType: order.transportType,
      recipientName: recipientEmail ? "Customer" : "Team", // Customize based on recipient
    });

    // Send email using notification manager
    const notificationManager = getNotificationManager();
    const result = await notificationManager.sendEmail({
      to: toEmail,
      subject,
      html,
      from: senderEmail,
    });

    if (result.success) {
      logger.info("Track order notification sent successfully", {
        orderId: order._id,
        uniqueId: order.refId,
        recipientEmail: toEmail,
      });
      return { success: true };
    } else {
      logger.error("Failed to send track order notification", {
        orderId: order._id,
        uniqueId: order.refId,
        recipientEmail: toEmail,
        error: result.error,
      });
      return { success: false, error: result.error };
    }
  } catch (error) {
    logger.error(
      `Error sending track order notification for order ${order._id}:`,
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    );
    return {
      success: false,
      error: "Failed to send track order notification.",
    };
  }
}
