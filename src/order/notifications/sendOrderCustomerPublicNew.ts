/**
 * Send Order Customer Public New Notification
 *
 * Sends order confirmation email to customer
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import Handlebars from "handlebars";
import { logger } from "@/core/logger";
import { IOrder } from "@/_global/models";
import { sendOrderNotification } from "@/notification/orderNotifications";
import { getPickupDatesString } from "./utils/getPickupDatesString";
import { getDeliveryDatesString } from "./utils/getDeliveryDatesString";
import { formatVehiclesHTML } from "./utils/formatVehiclesHTML";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Sirva portal IDs
 */
const SIRVA_PORTAL_IDS = [
  "621e2882dee77a00351e5aac",
  "65fb221d27f5b6f47701f8ea",
  "66056b34982f1bf738687859",
  "5e99f0b420e68d5f479d7317",
];

/**
 * Send order customer email notification
 */
export async function sendOrderCustomerPublicNew(
  order: IOrder,
): Promise<{ success: boolean; error?: string }> {
  if (!order) {
    logger.warn("Cannot send customer order email: Order is null");
    return { success: false, error: "Order is required" };
  }

  try {
    const senderEmail = "autologistics@mccollisters.com";
    const senderName = "McCollister's AutoLogistics";

    let logo: string | undefined;
    let companyName = "";

    const portalIdString = String(order.portalId);
    const isSirva = SIRVA_PORTAL_IDS.includes(portalIdString);

    // Determine template path
    const templatePath = isSirva
      ? join(__dirname, "../../../templates/customer-order-sirva.hbs")
      : join(__dirname, "../../../templates/customer-order-new.hbs");

    const mclogo =
      "https://res.cloudinary.com/dq27r8cov/image/upload/v1616097775/McCollister%27s/mccollisters-auto-logistics.png";

    // Handle special company logos
    if (order.companyName === "Move Easy") {
      companyName = "MoveEasy and";
      logo =
        "https://res.cloudinary.com/dq27r8cov/image/upload/v1616098696/McCollister%27s/moveeasy-logo.png";
    } else if (order.companyName === "AutoTrader.com") {
      companyName = "AutoTrader.com and";
      logo =
        "https://res.cloudinary.com/dq27r8cov/image/upload/v1631829206/McCollister%27s/autotrader-logo.png";
    }

    const recipientEmail = order.customer?.email;

    if (!recipientEmail) {
      logger.warn(
        `Cannot send customer order email: No customer email for order ${order._id}`,
      );
      return { success: false, error: "Customer email is required" };
    }

    const recipientName = order.customer?.name || "Customer";
    const subject = `Your Vehicle Transport Confirmation - Order #${order.refId}`;

    // Extract address information
    const pickupAddress =
      order.origin?.address?.address ||
      order.origin?.address?.addressLine1 ||
      "";
    const pickupCity = order.origin?.address?.city || "";
    const pickupState = order.origin?.address?.state || "";
    const pickupZip = order.origin?.address?.zip || "";

    const deliveryAddress =
      order.destination?.address?.address ||
      order.destination?.address?.addressLine1 ||
      "";
    const deliveryCity = order.destination?.address?.city || "";
    const deliveryState = order.destination?.address?.state || "";
    const deliveryZip = order.destination?.address?.zip || "";

    // Get date strings
    const pickupDates = getPickupDatesString(order);
    const deliveryDates = getDeliveryDatesString(order);

    // Format transport type
    const transportType =
      order.transportType?.charAt(0).toUpperCase() +
        order.transportType?.slice(1) || "Open";

    // Format vehicles HTML with pricing
    const vehicles = formatVehiclesHTML(order.vehicles, true);

    // Build terms URL
    const orderId = String(order._id);
    const termsUrl = `https://autovista.mccollisters.com/terms/${orderId}/${order.refId}`;

    // Load and compile template
    const templateSource = await readFile(templatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    // Prepare template data
    const html = template({
      logo: logo || mclogo,
      companyName,
      mclogo,
      pickupDates,
      pickupAddress,
      pickupCity,
      pickupState,
      pickupZip,
      deliveryDates,
      deliveryAddress,
      deliveryCity,
      deliveryState,
      deliveryZip,
      transportType,
      vehicles,
      uniqueId: order.refId,
      termsUrl,
      recipientName,
    });

    // Send email using order notification system
    const result = await sendOrderNotification({
      orderId: orderId,
      type: "customerConfirmation",
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
      logger.info("Customer order email sent successfully", {
        orderId: order._id,
        uniqueId: order.refId,
        recipientEmail,
        isSirva,
      });
    } else {
      logger.error("Failed to send customer order email", {
        orderId: order._id,
        uniqueId: order.refId,
        recipientEmail,
        error: result.error,
      });
    }

    return {
      success: result.success,
      error: result.error,
    };
  } catch (error) {
    logger.error("Error in sendOrderCustomerPublicNew:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
