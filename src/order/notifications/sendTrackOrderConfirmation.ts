/**
 * Send Track Order Confirmation Email Notification
 *
 * This service sends a confirmation email to the customer when they request to track an order.
 * This is separate from the internal notification sent to the team.
 */

import { logger } from "@/core/logger";
import { IOrder } from "@/_global/models";
import { getNotificationManager } from "@/notification";
import { join } from "path";
import { readFile } from "fs/promises";
import Handlebars from "handlebars";
import { resolveTemplatePath } from "./utils/resolveTemplatePath";

// __dirname and __filename are available in CommonJS modules

interface SendTrackOrderConfirmationParams {
  order: IOrder;
  recipientEmail?: string; // Optional: defaults to customer email
}

/**
 * Send track order confirmation email to customer
 */
export async function sendTrackOrderConfirmation({
  order,
  recipientEmail,
}: SendTrackOrderConfirmationParams): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!order) {
    return { success: false, error: "Order object is required." };
  }

  try {
    // Get email template values
    const { getEmailTemplate } = await import("@/email/services/getEmailTemplate");
    const emailTemplate = await getEmailTemplate("Track Order Confirmation");
    
    const senderEmail = emailTemplate.senderEmail;
    const senderName = emailTemplate.senderName;
    const subject = emailTemplate.subject || `Tracking Request for Order #${order.refId}`;
    const toEmail =
      recipientEmail || order.customer?.email || "anna@periscopeatlantic.com"; // Fallback email from old API

    // Load and compile Handlebars template
    const templatePath = join(
      __dirname,
      "../../../templates/track-order-confirmation.hbs",
    );
    const resolvedTemplatePath = await resolveTemplatePath(
      templatePath,
      join(process.cwd(), "src/templates/track-order-confirmation.hbs"),
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
      to: toEmail,
      subject,
      html,
      from: senderEmail,
      templateName: "Track Order Confirmation",
    });

    if (result.success) {
      logger.info("Track order confirmation sent successfully", {
        orderId: order._id,
        refId: order.refId,
        recipientEmail: toEmail,
      });
      return { success: true };
    } else {
      logger.error("Failed to send track order confirmation", {
        orderId: order._id,
        refId: order.refId,
        recipientEmail: toEmail,
        error: result.error,
      });
      return { success: false, error: result.error };
    }
  } catch (error) {
    logger.error(
      `Error sending track order confirmation for order ${order._id}:`,
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    );
    return {
      success: false,
      error: "Failed to send track order confirmation.",
    };
  }
}


