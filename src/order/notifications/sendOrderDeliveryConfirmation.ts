/**
 * Send Order Delivery Confirmation Email Notification
 *
 * This service sends a delivery confirmation email notification.
 * Can be manually triggered or called from other controllers.
 */

import { logger } from "@/core/logger";
import { IOrder } from "@/_global/models";
import { sendOrderNotification } from "@/notification/orderNotifications";
import { join } from "path";
import { readFile } from "fs/promises";
import Handlebars from "handlebars";
import { format } from "date-fns";
import { formatVehiclesHTML } from "./utils/formatVehiclesHTML";
import { resolveTemplatePath } from "./utils/resolveTemplatePath";

// Using fileURLToPath and dirname for __dirname equivalent in ES modules
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const formatTransportType = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const normalized = raw.toLowerCase();
  if (normalized === "whiteglove") {
    return "White Glove";
  }
  const spaced = raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced
    .split(" ")
    .map((word) =>
      word ? `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}` : "",
    )
    .join(" ");
};

interface SendOrderDeliveryConfirmationParams {
  order: IOrder;
  recipients: Array<{
    email: string;
    name?: string;
  }>;
  userId?: string; // Optional, for logging purposes
  deliveryAdjustedDate?: Date; // Optional: actual delivery date
  deliveryAdjustedDateString?: string; // Optional: formatted delivery date string
}

/**
 * Default email configuration
 * In the old API, this came from an Email model with templateName "Delivery Confirmation"
 */
const DEFAULT_EMAIL_CONFIG = {
  // Will be loaded from email template in the function
  senderEmail: "",
  senderName: "",
  emailIntro: "We are confirming that your vehicle has been delivered.",
};

/**
 * Send order delivery confirmation email
 * Sends to multiple recipients
 */
export async function sendOrderDeliveryConfirmation({
  order,
  recipients,
  userId,
  deliveryAdjustedDate,
  deliveryAdjustedDateString,
}: SendOrderDeliveryConfirmationParams): Promise<
  Array<{ recipient: string; success: boolean; error?: string }>
> {
  try {
    if (!order) {
      return [
        {
          recipient: "unknown",
          success: false,
          error: "Order is required.",
        },
      ];
    }

    if (!recipients || recipients.length === 0) {
      return [
        {
          recipient: "unknown",
          success: false,
          error: "At least one recipient is required.",
        },
      ];
    }

    // Get email template values
    const { getEmailTemplate } = await import("@/email/services/getEmailTemplate");
    const emailTemplate = await getEmailTemplate("Delivery Confirmation");
    
    const senderEmail = emailTemplate.senderEmail || DEFAULT_EMAIL_CONFIG.senderEmail;
    const senderName = emailTemplate.senderName || DEFAULT_EMAIL_CONFIG.senderName;
    const emailIntro = emailTemplate.emailIntro || DEFAULT_EMAIL_CONFIG.emailIntro;

    // Format order ID for subject
    const orderReg = order.reg ? `${order.reg} / ` : "";
    const orderId = order.reg ? `(${order.refId})` : order.refId;

    const subject = `Vehicle Delivery Confirmation - REG #${orderReg}${orderId}`;

    // Extract delivery information
    const deliveryContactName =
      order.destination?.contact?.name ||
      order.destination?.contact?.companyName ||
      "";
    const deliveryPhone = order.destination?.contact?.phone || "";
    const deliveryMobilePhone = order.destination?.contact?.phoneMobile || "";
    const deliveryAddress = order.destination?.address?.address || "";
    const deliveryCity = order.destination?.address?.city || "";
    const deliveryState = order.destination?.address?.state || "";
    const deliveryZip = order.destination?.address?.zip || "";

    // Format delivery date
    let formattedDeliveryDate = "";
    if (deliveryAdjustedDateString) {
      formattedDeliveryDate = ` on ${deliveryAdjustedDateString}`;
    } else if (deliveryAdjustedDate) {
      formattedDeliveryDate = ` on ${format(
        new Date(deliveryAdjustedDate),
        "MM/dd/yy",
      )}`;
    } else {
      // Use current date as fallback
      formattedDeliveryDate = ` on ${format(new Date(), "MM/dd/yy")}`;
    }

    // Get delivery scheduled end date if available
    const deliveryScheduledEndsAt = order.schedule?.deliveryEstimated
      ? order.schedule.deliveryEstimated[
          order.schedule.deliveryEstimated.length - 1
        ]
      : null;

    const transportType = formatTransportType(order.transportType);
    const refId = order.refId;
    const reg = order.reg;
    const vehicles = formatVehiclesHTML(order.vehicles, false);

    // Load and compile Handlebars template
    const templatePath = join(__dirname, "../../templates/order-delivery.hbs");
    const resolvedTemplatePath = await resolveTemplatePath(
      templatePath,
      join(process.cwd(), "src/templates/order-delivery.hbs"),
    );
    const templateSource = await readFile(resolvedTemplatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    // Send email to each recipient
    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        const htmlContent = template({
          deliveryAdjustedDate: formattedDeliveryDate,
          deliveryScheduledEndsAt: deliveryScheduledEndsAt
            ? format(new Date(deliveryScheduledEndsAt), "MM/dd/yyyy")
            : null,
          deliveryContactName,
          deliveryPhone,
          deliveryMobilePhone,
          deliveryAddress,
          deliveryCity,
          deliveryState,
          deliveryZip,
          transportType,
          vehicles,
          intro: emailIntro,
          reg,
          refId,
          recipientName: recipient.name ? ` ${recipient.name}` : "",
        });

        const result = await sendOrderNotification({
          orderId: String(order._id),
          type: "agentsDeliveryConfirmation", // Using appropriate notification type
          email: {
            to: recipient.email,
            subject,
            html: htmlContent,
            from: senderEmail,
            fromName: senderName,
            replyTo: senderEmail,
          },
          recipientEmail: recipient.email,
        });

        return {
          recipient: recipient.email,
          success: result.success,
          error: result.success
            ? undefined
            : "Failed to send delivery confirmation",
        };
      }),
    );

    const finalResults = results.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : {
            recipient: "unknown",
            success: false,
            error: String(result.reason),
          },
    );

    const successCount = finalResults.filter((r) => r.success).length;

    logger.info("Order delivery confirmation emails sent", {
      orderId: order._id,
      refId: order.refId,
      recipientCount: recipients.length,
      successCount,
    });

    return finalResults;
  } catch (error) {
    logger.error(
      `Error sending order delivery confirmation for order ${order._id}:`,
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    );
    return recipients.map((r) => ({
      recipient: r.email,
      success: false,
      error: "Failed to send delivery confirmation.",
    }));
  }
}
