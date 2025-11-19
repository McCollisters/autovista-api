/**
 * Send Order Agent Email Notification
 *
 * Sends order confirmation email to agents
 * Only sends if disableAgentNotifications is NOT true on the portal
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import Handlebars from "handlebars";
import { logger } from "@/core/logger";
import { Order, Portal } from "@/_global/models";
import { sendOrderNotification } from "@/notification/orderNotifications";
import { getPickupDatesString } from "./utils/getPickupDatesString";
import { getDeliveryDatesString } from "./utils/getDeliveryDatesString";
import { formatVehiclesHTML } from "./utils/formatVehiclesHTML";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SendOrderAgentParams {
  orderId: string;
  userId?: string;
}

/**
 * Default email configuration
 * In the old API, this came from an Email model with templateName "Order Agent"
 * Now loaded from EmailTemplate model
 */
const DEFAULT_EMAIL_CONFIG = {
  senderEmail: "autologistics@mccollisters.com",
  senderName: "McCollister's AutoLogistics",
  emailIntro: "Thank you for your order!",
};

/**
 * Send order agent email notification
 */
export async function sendOrderAgentEmail({
  orderId,
  userId,
}: SendOrderAgentParams): Promise<{ success: boolean; error?: string }> {
  try {
    // Get order and populate portal to check disableAgentNotifications
    const order = await Order.findById(orderId).populate("portalId");

    if (!order) {
      logger.warn(`Order not found: ${orderId}`);
      return { success: false, error: "Order not found" };
    }

    const portal = await Portal.findById(order.portalId);

    if (!portal) {
      logger.warn(`Portal not found for order: ${orderId}`);
      return { success: false, error: "Portal not found" };
    }

    // Check if agent notifications are disabled
    if (portal.disableAgentNotifications === true) {
      logger.info(
        `Agent notifications are disabled for portal ${portal._id}, skipping order agent email`,
      );
      return { success: true }; // Return success but don't send
    }

    // Check if order has agents
    if (!order.agents || order.agents.length === 0) {
      logger.warn(`Order ${orderId} has no agents to notify`);
      return { success: false, error: "No agents found for order" };
    }

    // Filter agents that have email addresses
    const recipients = order.agents.filter((agent) => agent.email);

    if (recipients.length === 0) {
      logger.warn(`Order ${orderId} has agents but no email addresses`);
      return { success: false, error: "No agent email addresses found" };
    }

    // Load and compile Handlebars template
    const templatePath = join(__dirname, "../../../templates/order-agent.hbs");
    const templateSource = await readFile(templatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    // Prepare template data
    const pickupDates = getPickupDatesString(order);
    const deliveryDates = getDeliveryDatesString(order);
    const vehicles = formatVehiclesHTML(order.vehicles, false);
    const transferee = order.customer?.name || order.customer?.email || "";

    // Build subject
    let subject = `New Booked Order Confirmation - Order #${order.refId}`;

    if (order.reg) {
      subject += ` / REG# ${order.reg}`;
    }

    if (order.customer?.name) {
      subject += ` - ${order.customer.name}`;
    }

    // Extract pickup and delivery contact information
    const pickupContactName =
      order.origin?.contact?.name || order.origin?.contact?.companyName || "";
    const pickupPhone = order.origin?.contact?.phone || "";
    const pickupMobilePhone = order.origin?.contact?.phoneMobile || "";
    const pickupAddress =
      order.origin?.address?.address ||
      order.origin?.address?.addressLine1 ||
      "";
    const pickupCity = order.origin?.address?.city || "";
    const pickupState = order.origin?.address?.state || "";
    const pickupZip = order.origin?.address?.zip || "";

    const deliveryContactName =
      order.destination?.contact?.name ||
      order.destination?.contact?.companyName ||
      "";
    const deliveryPhone = order.destination?.contact?.phone || "";
    const deliveryMobilePhone = order.destination?.contact?.phoneMobile || "";
    const deliveryAddress =
      order.destination?.address?.address ||
      order.destination?.address?.addressLine1 ||
      "";
    const deliveryCity = order.destination?.address?.city || "";
    const deliveryState = order.destination?.address?.state || "";
    const deliveryZip = order.destination?.address?.zip || "";

    // Get email template values
    const { getEmailTemplate } = await import("@/email/services/getEmailTemplate");
    const emailTemplate = await getEmailTemplate("Order Agent");
    
    const senderEmail = emailTemplate.senderEmail || DEFAULT_EMAIL_CONFIG.senderEmail;
    const senderName = emailTemplate.senderName || DEFAULT_EMAIL_CONFIG.senderName;
    const emailIntro = emailTemplate.emailIntro || DEFAULT_EMAIL_CONFIG.emailIntro;

    // Format transport type for display
    const transportType =
      order.transportType?.charAt(0).toUpperCase() +
        order.transportType?.slice(1) || "Open";

    // Send email to each recipient
    const emailPromises = recipients.map(async (recipient) => {
      const html = template({
        recipientName: recipient.name || "Agent",
        intro: emailIntro,
        uniqueId: order.refId,
        reg: order.reg || "",
        transferee,
        pickupDates,
        pickupContactName,
        pickupPhone,
        pickupMobilePhone,
        pickupAddress,
        pickupCity,
        pickupState,
        pickupZip,
        deliveryDates,
        deliveryContactName,
        deliveryPhone,
        deliveryMobilePhone,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        deliveryZip,
        transportType,
        vehicles,
      });

      const result = await sendOrderNotification({
        orderId,
        type: "agentsConfirmation",
        email: {
          to: recipient.email!,
          subject,
          html,
          from: senderEmail,
          replyTo: senderEmail,
        },
        recipientEmail: recipient.email!,
      });

      return { recipient: recipient.email, result };
    });

    const results = await Promise.allSettled(emailPromises);

    // Log results
    let successCount = 0;
    let failureCount = 0;

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        if (result.value.result.success) {
          successCount++;
          logger.info(
            `Order agent email sent successfully to ${result.value.recipient}`,
          );
        } else {
          failureCount++;
          logger.error(
            `Failed to send order agent email to ${result.value.recipient}: ${result.value.result.error}`,
          );
        }
      } else {
        failureCount++;
        logger.error(
          `Error sending order agent email to ${recipients[index].email}:`,
          result.reason,
        );
      }
    });

    logger.info(
      `Order agent emails sent: ${successCount} successful, ${failureCount} failed`,
    );

    return {
      success: successCount > 0,
      error:
        failureCount > 0
          ? `${failureCount} email(s) failed to send`
          : undefined,
    };
  } catch (error) {
    logger.error("Error in sendOrderAgentEmail:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
