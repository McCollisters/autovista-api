/**
 * Send Survey Email Notification
 *
 * This service sends a survey email to customers.
 * Can be manually triggered or called from other controllers.
 */

import { logger } from "@/core/logger";
import { Order } from "@/_global/models";
import { sendOrderCustomerEmail } from "@/notification/orderNotifications";
import { join } from "path";
import { readFile } from "fs/promises";
import Handlebars from "handlebars";

// Using fileURLToPath and dirname for __dirname equivalent in ES modules
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SendSurveyParams {
  orderId: string;
  surveyUrl?: string; // Optional: custom survey URL, defaults to order-based URL
}

/**
 * Send survey email notification
 */
export async function sendSurvey({
  orderId,
  surveyUrl,
}: SendSurveyParams): Promise<{ success: boolean; error?: string }> {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return { success: false, error: "Order not found." };
    }

    const recipientEmail = order.customer?.email;
    const recipientName = order.customer?.name;

    if (!recipientEmail) {
      logger.warn(`Cannot send survey: No customer email for order ${orderId}`);
      return { success: false, error: "Customer email is required." };
    }

    // Generate survey URL if not provided
    const url =
      surveyUrl ||
      `https://autovista.mccollisters.com/customer-survey/${orderId}`;

    const senderEmail = "autologistics@mccollisters.com";
    const senderName = "McCollister's AutoLogistics";
    const subject = "We're Listening. How did we do?";

    // Load and compile Handlebars template
    const templatePath = join(__dirname, "../../../templates/survey.hbs");
    const templateSource = await readFile(templatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    // Prepare template data
    const htmlContent = template({
      url,
      recipientName: recipientName || "Customer",
    });

    // Send email using order notification helper
    const result = await sendOrderCustomerEmail(
      orderId,
      "survey",
      subject,
      htmlContent,
    );

    if (result) {
      logger.info("Survey email sent successfully", {
        orderId,
        uniqueId: order.refId,
        recipientEmail,
        surveyUrl: url,
      });
      return { success: true };
    } else {
      logger.error("Failed to send survey email", {
        orderId,
        uniqueId: order.refId,
        recipientEmail,
      });
      return { success: false, error: "Failed to send survey email." };
    }
  } catch (error) {
    logger.error(`Error sending survey email for order ${orderId}:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { success: false, error: "Failed to send survey email." };
  }
}
