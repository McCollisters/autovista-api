/**
 * Send MMI Order Notification
 *
 * Sends MMI-specific order notification to designated recipient
 */

import { readFile } from "fs/promises";
import path from "path";
import Handlebars from "handlebars";
import { logger } from "@/core/logger";
import { IOrder } from "@/_global/models";
import { getNotificationManager } from "@/notification";
import { getPickupDatesString } from "./utils/getPickupDatesString";
import { getDeliveryDatesString } from "./utils/getDeliveryDatesString";
import { resolveTemplatePath } from "./utils/resolveTemplatePath";

// __dirname and __filename are available in CommonJS modules

interface SendMMIOrderNotificationParams {
  order: IOrder;
  recipientEmail: string;
}

/**
 * Send MMI order notification
 */
export async function sendMMIOrderNotification({
  recipientEmail,
  order,
}: SendMMIOrderNotificationParams): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const senderEmail = "autologistics@mccollisters.com";
    const senderName = "McCollister's AutoLogistics";

    let subject = `New Order #${order.refId}`;

    if (order.reg) {
      subject += ` / REG# ${order.reg}`;
    }

    // Extract pickup information
    const pickupAddress =
      order.origin?.address?.address ||
      "";
    const pickupCity = order.origin?.address?.city || "";
    const pickupState = order.origin?.address?.state || "";
    const pickupZip = order.origin?.address?.zip || "";

    // Extract customer information
    let customerFullName = order.customer?.name || "Not provided";
    let customerPhone = order.customer?.phone || "Not provided";
    let customerEmail = order.customer?.email || "Not provided";

    // Extract delivery information
    const deliveryAddress =
      order.destination?.address?.address ||
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

    // Format vehicles
    let vehicles = "";
    if (order.vehicles && order.vehicles.length > 0) {
      order.vehicles.forEach((vehicle) => {
        const operableStatus =
          vehicle.isInoperable === false ? "Inoperable" : "Operable";
        const vehiclePrice = vehicle.pricing?.total || 0;
        vehicles += `<p style="box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; letter-spacing: 0.5px; line-height: 1.4; margin-bottom: 15px; ">${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""} (${operableStatus}): $${vehiclePrice.toFixed(2)}</p>`;
      });
    }

    // Get pricing totals
    const billRate = order.totalPricing?.total || 0;
    const totalPricing = order.totalPricing?.total || 0;

    // Load and compile template
    const templatePath = path.join(
      __dirname,
      "../../../templates/mmi-order-notification.hbs",
    );
    const resolvedTemplatePath = await resolveTemplatePath(
      templatePath,
      path.join(process.cwd(), "src/templates/mmi-order-notification.hbs"),
    );
    const templateSource = await readFile(resolvedTemplatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    // Prepare template data
    const html = template({
      customerFullName,
      customerPhone,
      customerEmail,
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
      refId: order.refId,
      reg: order.reg || "",
      totalPricing: totalPricing.toFixed(2),
      billRate: billRate.toFixed(2),
      logo: "https://autovista-assets.s3.us-west-1.amazonaws.com/MCC-Wordmark-RGB-Blue.png",
    });

    // Send email using notification manager
    const notificationManager = getNotificationManager();
    const result = await notificationManager.sendEmail({
      to: recipientEmail,
      from: senderEmail,
      subject,
      html,
      replyTo: senderEmail,
      templateName: "MMI Order Notification",
    });

    if (result.success) {
      logger.info("MMI order notification sent successfully", {
        orderId: order._id,
        refId: order.refId,
        recipientEmail,
      });
    } else {
      logger.error("Failed to send MMI order notification", {
        orderId: order._id,
        refId: order.refId,
        recipientEmail,
        error: result.error,
      });
    }

    return {
      success: result.success ?? false,
      error: result.error,
    };
  } catch (error) {
    logger.error("Error in sendMMIOrderNotification:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
