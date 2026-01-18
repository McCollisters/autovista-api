/**
 * Send Order Pickup Confirmation Email Notification
 *
 * This service sends a pickup confirmation email notification.
 * Can be manually triggered or called from other controllers.
 */

import { logger } from "@/core/logger";
import { IOrder } from "@/_global/models";
import { sendOrderNotification } from "@/notification/orderNotifications";
import { join } from "path";
import { readFile } from "fs/promises";
import Handlebars from "handlebars";
import { getPickupDatesString } from "./utils/getPickupDatesString";
import { getDeliveryDatesString } from "./utils/getDeliveryDatesString";
import { formatVehiclesHTML } from "./utils/formatVehiclesHTML";

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

interface SendOrderPickupConfirmationParams {
  order: IOrder;
  recipients: Array<{
    email: string;
    name?: string;
  }>;
  userId?: string; // Optional, for logging purposes
}

/**
 * Default email configuration
 * In the old API, this came from an Email model with templateName "Pickup Confirmation"
 */
const DEFAULT_EMAIL_CONFIG = {
  senderEmail: "autologistics@mccollisters.com",
  senderName: "McCollister's AutoLogistics",
  emailIntro: "We are confirming that your vehicle has been picked up.",
};

/**
 * Send order pickup confirmation email
 * Sends to multiple recipients
 */
export async function sendOrderPickupConfirmation({
  order,
  recipients,
  userId,
}: SendOrderPickupConfirmationParams): Promise<
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

    const { senderEmail, senderName, emailIntro } = DEFAULT_EMAIL_CONFIG;

    // Format order ID for subject
    const orderReg = order.reg ? `${order.reg} / ` : "";
    const orderId = order.reg ? `(${order.refId})` : order.refId;

    const subject = `Vehicle Pickup Confirmation - REG #${orderReg}${orderId}`;

    // Extract pickup information
    const pickupContactName =
      order.origin?.contact?.name || order.origin?.contact?.companyName || "";
    const pickupPhone = order.origin?.contact?.phone || "";
    const pickupMobilePhone = order.origin?.contact?.phoneMobile || "";
    const pickupAddress = order.origin?.address?.address || "";
    const pickupCity = order.origin?.address?.city || "";
    const pickupState = order.origin?.address?.state || "";
    const pickupZip = order.origin?.address?.zip || "";

    const pickupDates = getPickupDatesString(order);
    const deliveryDates = getDeliveryDatesString(order);
    const transportType = formatTransportType(order.transportType);
    const uniqueId = order.refId;
    const reg = order.reg;
    const vehicles = formatVehiclesHTML(order.vehicles, false);

    // Load and compile Handlebars template
    const templatePath = join(__dirname, "../../templates/order-pickup.hbs");
    const templateSource = await readFile(templatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    // Send email to each recipient
    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        const htmlContent = template({
          reg,
          pickupAdjustedDate: pickupDates ? ` on ${pickupDates}` : "",
          deliveryDates,
          pickupContactName,
          pickupPhone,
          pickupMobilePhone,
          pickupAddress,
          pickupCity,
          pickupState,
          pickupZip,
          transportType,
          vehicles,
          intro: emailIntro,
          uniqueId,
          recipientName: recipient.name ? ` ${recipient.name}` : "",
        });

        const result = await sendOrderNotification({
          orderId: String(order._id),
          type: "agentsPickupConfirmation", // Using appropriate notification type
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
          error: result.success ? undefined : "Failed to send pickup confirmation",
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

    logger.info("Order pickup confirmation emails sent", {
      orderId: order._id,
      uniqueId: order.refId,
      recipientCount: recipients.length,
      successCount,
    });

    return finalResults;
  } catch (error) {
    logger.error(
      `Error sending order pickup confirmation for order ${order._id}:`,
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    );
    return recipients.map((r) => ({
      recipient: r.email,
      success: false,
      error: "Failed to send pickup confirmation.",
    }));
  }
}

