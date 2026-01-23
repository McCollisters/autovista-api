/**
 * Send COD Payment Request Notification
 *
 * Sends payment request email for COD orders
 */

import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import Handlebars from "handlebars";
import { logger } from "@/core/logger";
import { IOrder } from "@/_global/models";
import { getNotificationManager } from "@/notification";
import { sendOrderNotification } from "@/notification/orderNotifications";
import { getPickupDatesString } from "./utils/getPickupDatesString";
import { resolveTemplatePath } from "./utils/resolveTemplatePath";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Send COD payment request notification
 */
export async function sendCODPaymentRequest(
  order: IOrder,
  overrides: { recipientEmail?: string; recipientName?: string } = {},
): Promise<{ success: boolean; error?: string }> {
  if (!order) {
    logger.warn("Cannot send COD payment request: Order is null");
    return { success: false, error: "Order is required" };
  }

  try {
    // Get email template values
    const { getEmailTemplate } = await import(
      "@/email/services/getEmailTemplate"
    );
    const emailTemplate = await getEmailTemplate("Payment Request");

    const senderEmail = emailTemplate.senderEmail;
    const senderName = emailTemplate.senderName;
    const recipientEmail = overrides.recipientEmail || order.customer?.email;

    if (!recipientEmail) {
      logger.warn(
        `Cannot send COD payment request: No recipient email provided for order ${order._id}`,
      );
      return {
        success: false,
        error: "Error sending payment request - recipient email required.",
      };
    }

    const pickupDates = getPickupDatesString(order);
    const subject = emailTemplate.subject || "Payment for your Auto Transport";

    // Format vehicles string
    let vehiclesString = "";
    if (order.vehicles && order.vehicles.length > 0) {
      const firstVehicle = order.vehicles[0];
      vehiclesString = `${firstVehicle.year || ""} ${firstVehicle.make || ""} ${firstVehicle.model || ""}`;

      if (order.vehicles.length > 1) {
        for (let i = 1; i < order.vehicles.length; i++) {
          const vehicle = order.vehicles[i];
          vehiclesString += ` and ${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`;
        }
      }
    }

    // Load and compile template
    const templatePath = path.join(
      __dirname,
      "../../templates/cod-payment-request.hbs",
    );
    const resolvedTemplatePath = await resolveTemplatePath(
      templatePath,
      path.join(process.cwd(), "src/templates/cod-payment-request.hbs"),
    );
    const templateSource = await readFile(resolvedTemplatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    // Prepare template data
    const html = template({
      pickupDates,
      vehiclesString,
      totalPrice: (order.totalPricing?.total || 0).toFixed(2),
      refId: order.refId,
      recipientName: overrides.recipientName || order.customer?.name || "Customer",
    });

    // Send email using order notification system to track it
    const result = await sendOrderNotification({
      orderId: String(order._id),
      type: "paymentRequest",
      email: {
        to: recipientEmail,
        subject,
        html,
        from: senderEmail,
        replyTo: senderEmail,
      },
      recipientEmail,
    });

    if (result.success) {
      logger.info("COD payment request sent successfully", {
        orderId: order._id,
        refId: order.refId,
        recipientEmail,
      });
    } else {
      logger.error("Failed to send COD payment request", {
        orderId: order._id,
        refId: order.refId,
        recipientEmail,
      });
    }

    return {
      success: result.success,
    };
  } catch (error) {
    logger.error("Error in sendCODPaymentRequest:", error);
    return {
      success: false,
      error: "Error sending payment request.",
    };
  }
}
