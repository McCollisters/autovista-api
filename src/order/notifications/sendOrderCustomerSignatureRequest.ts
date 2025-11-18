/**
 * Send Order Customer Signature Request
 *
 * This service:
 * 1. Sends a signature request notification email to the customer
 * 2. Sends the HelloSign signature request via HelloSign API
 *
 * Uses different templates for Sirva portals vs regular portals.
 * Uses different HelloSign templates for MMI vs regular portals.
 */

import { logger } from "@/core/logger";
import { Order } from "@/_global/models";
import { sendOrderCustomerEmail } from "@/notification/orderNotifications";
import { requestOrderSignature } from "./requestSignature";
import { join } from "path";
import { readFile } from "fs/promises";
import Handlebars from "handlebars";
import { SIRVA_PORTALS } from "@/_global/constants/portalIds";

// Using fileURLToPath and dirname for __dirname equivalent in ES modules
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SendOrderCustomerSignatureRequestParams {
  orderId: string;
}

/**
 * Send order customer signature request
 * This sends both the email notification and the HelloSign request
 */
export async function sendOrderCustomerSignatureRequest({
  orderId,
}: SendOrderCustomerSignatureRequestParams): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return { success: false, error: "Order not found." };
    }

    const recipientEmail = order.customer?.email;
    const recipientName = order.customer?.name || "Customer";

    if (!recipientEmail) {
      logger.warn(
        `Cannot send signature request: No customer email for order ${orderId}`,
      );
      return { success: false, error: "Customer email is required." };
    }

    // Step 1: Send email notification
    const senderEmail = "autologistics@mccollisters.com";
    const senderName = "McCollister's AutoLogistics";

    // Determine if this is a Sirva portal
    const portalId = String(order.portalId);
    const isSirva = SIRVA_PORTALS.includes(portalId);

    // Select template based on portal type
    const templatePath = isSirva
      ? join(
          __dirname,
          "../../../templates/customer-signature-request-sirva.hbs",
        )
      : join(__dirname, "../../../templates/customer-signature-request.hbs");

    const subject = `Signature Request Required - Order #${order.refId}`;

    // Load and compile Handlebars template
    const templateSource = await readFile(templatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    // Prepare template data
    const htmlContent = template({
      recipientName: recipientName || "Customer",
    });

    // Send email using order notification helper
    const emailResult = await sendOrderCustomerEmail(
      orderId,
      "signatureRequest",
      subject,
      htmlContent,
    );

    if (!emailResult) {
      logger.error("Failed to send signature request email", {
        orderId,
        uniqueId: order.refId,
        recipientEmail,
      });
      return {
        success: false,
        error: "Failed to send signature request email.",
      };
    }

    logger.info("Signature request email sent successfully", {
      orderId,
      uniqueId: order.refId,
      recipientEmail,
      isSirva,
    });

    // Step 2: Send HelloSign signature request
    const signatureResult = await requestOrderSignature({
      orderId,
      recipientEmail,
      recipientName,
    });

    if (!signatureResult.success) {
      logger.error("Failed to send HelloSign signature request", {
        orderId,
        uniqueId: order.refId,
        error: signatureResult.error,
      });
      // Email was sent successfully, so we return partial success
      return {
        success: false,
        error: `Email sent but HelloSign request failed: ${signatureResult.error}`,
      };
    }

    logger.info("Signature request sent successfully (email + HelloSign)", {
      orderId,
      uniqueId: order.refId,
      recipientEmail,
    });

    return { success: true };
  } catch (error) {
    logger.error(
      `Error sending customer signature request for order ${orderId}:`,
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    );
    return { success: false, error: "Failed to send signature request." };
  }
}
