/**
 * Manual Email Trigger Controller
 *
 * Allows frontend to manually trigger email notifications
 */

import express from "express";
import { logger } from "@/core/logger";
import { Order, Quote, Portal } from "@/_global/models";
import { getNotificationManager } from "@/notification";
import { sendOrderNotification } from "@/notification/orderNotifications";
import { sendOrderAgentEmail } from "@/order/notifications/sendOrderAgent";
import { sendCODPaymentRequest } from "@/order/notifications/sendCODPaymentRequest";
import { sendOrderCustomerPublicNew } from "@/order/notifications/sendOrderCustomerPublicNew";
import { sendMMIOrderNotification } from "@/order/notifications/sendMMIOrderNotification";
import { sendWhiteGloveNotification } from "@/order/notifications/sendWhiteGloveNotification";
import { sendTrackOrderNotification } from "@/order/notifications/sendTrackOrderNotification";
import { sendOrderPickupConfirmation } from "@/order/notifications/sendOrderPickupConfirmation";
import { sendOrderDeliveryConfirmation } from "@/order/notifications/sendOrderDeliveryConfirmation";
import { sendOrderCustomerSignatureRequest } from "@/order/notifications/sendOrderCustomerSignatureRequest";
import { sendSurvey } from "@/order/notifications/sendSurvey";
import { sendCarriers } from "@/notification/sendCarriers";
import type { OrderNotificationType } from "@/notification/orderNotifications";

interface SendEmailRequestBody {
  emailType: string;
  recipients: Array<{
    name?: string;
    email: string;
  }>;
  orderId?: string;
  quoteId?: string;
  portalId?: string;
  customSubject?: string;
  customContent?: {
    html?: string;
    text?: string;
  };
  // For survey notifications
  surveyUrl?: string; // Optional: custom survey URL
  // For carrier sign-up notifications
  carrierData?: {
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    phone?: string;
  };
}

/**
 * Send manual email notification
 */
export const sendManualEmail = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const {
      emailType,
      recipients,
      orderId,
      quoteId,
      portalId,
      customSubject,
      customContent,
      carrierData,
      surveyUrl,
    } = req.body as SendEmailRequestBody;

    // Validate required fields
    if (!emailType) {
      return next({ statusCode: 400, message: "Email type is required." });
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return next({
        statusCode: 400,
        message: "At least one recipient is required.",
      });
    }

    // Validate recipient emails
    const invalidRecipients = recipients.filter(
      (r) => !r.email || typeof r.email !== "string",
    );
    if (invalidRecipients.length > 0) {
      return next({
        statusCode: 400,
        message: "All recipients must have a valid email address.",
      });
    }

    const notificationManager = getNotificationManager();

    // Handle different email types
    let results: Array<{
      recipient: string;
      success: boolean;
      error?: string;
    }> = [];

    switch (emailType) {
      case "orderAgent":
        if (!orderId) {
          return next({
            statusCode: 400,
            message: "Order ID is required for order agent emails.",
          });
        }
        // Use the existing sendOrderAgentEmail function
        const agentResult = await sendOrderAgentEmail({ orderId });
        results = recipients.map((r) => ({
          recipient: r.email,
          success: agentResult.success ?? false,
          error: agentResult.error,
        }));
        break;

      case "customerConfirmation":
        if (!orderId) {
          return next({
            statusCode: 400,
            message: "Order ID is required for customer confirmation emails.",
          });
        }
        const order = await Order.findById(orderId);
        if (!order) {
          return next({ statusCode: 404, message: "Order not found." });
        }
        const customerResult = await sendOrderCustomerPublicNew(order);
        results = recipients.map((r) => ({
          recipient: r.email,
          success: customerResult.success ?? false,
          error: customerResult.error,
        }));
        break;

      case "paymentRequest":
        if (!orderId) {
          return next({
            statusCode: 400,
            message: "Order ID is required for payment request emails.",
          });
        }
        const codOrder = await Order.findById(orderId);
        if (!codOrder) {
          return next({ statusCode: 404, message: "Order not found." });
        }
        const paymentResult = await sendCODPaymentRequest(codOrder);
        results = recipients.map((r) => ({
          recipient: r.email,
          success: paymentResult.success ?? false,
          error: paymentResult.error,
        }));
        break;

      case "whiteGlove":
        if (!orderId) {
          return next({
            statusCode: 400,
            message: "Order ID is required for white glove emails.",
          });
        }
        const wgOrder = await Order.findById(orderId);
        if (!wgOrder) {
          return next({ statusCode: 404, message: "Order not found." });
        }
        await sendWhiteGloveNotification({ order: wgOrder });
        results = recipients.map((r) => ({
          recipient: r.email,
          success: true,
        }));
        break;

      case "mmiOrder":
        if (!orderId) {
          return next({
            statusCode: 400,
            message: "Order ID is required for MMI order emails.",
          });
        }
        const mmiOrder = await Order.findById(orderId);
        if (!mmiOrder) {
          return next({ statusCode: 404, message: "Order not found." });
        }
        const mmiResult = await sendMMIOrderNotification({
          order: mmiOrder,
          recipientEmail: recipients[0].email,
        });
        results = recipients.map((r) => ({
          recipient: r.email,
          success: mmiResult.success ?? false,
          error: mmiResult.error,
        }));
        break;

      case "trackOrder":
        if (!orderId) {
          return next({
            statusCode: 400,
            message: "Order ID is required for track order emails.",
          });
        }
        const trackOrder = await Order.findById(orderId);
        if (!trackOrder) {
          return next({ statusCode: 404, message: "Order not found." });
        }
        // Send to each recipient (can be internal team or customer)
        const trackResults = await Promise.allSettled(
          recipients.map(async (recipient) => {
            const result = await sendTrackOrderNotification({
              order: trackOrder,
              recipientEmail: recipient.email,
            });
            return {
              recipient: recipient.email,
              success: result.success,
              error: result.error,
            };
          }),
        );
        results = trackResults.map((result) =>
          result.status === "fulfilled"
            ? result.value
            : {
                recipient: "unknown",
                success: false,
                error: String(result.reason),
              },
        );
        break;

      case "carrierSignup":
        // Carrier sign-up notification
        if (!carrierData || !carrierData.email) {
          return next({
            statusCode: 400,
            message:
              "Carrier data with email is required for carrier sign-up notifications.",
          });
        }

        results = await sendCarriers({
          email: carrierData.email,
          firstName: carrierData.firstName,
          lastName: carrierData.lastName,
          company: carrierData.company,
          phone: carrierData.phone,
          recipients,
        });
        break;

      case "pickupConfirmation":
        if (!orderId) {
          return next({
            statusCode: 400,
            message: "Order ID is required for pickup confirmation emails.",
          });
        }
        const pickupOrder = await Order.findById(orderId);
        if (!pickupOrder) {
          return next({ statusCode: 404, message: "Order not found." });
        }
        results = await sendOrderPickupConfirmation({
          order: pickupOrder,
          recipients,
        });
        break;

      case "deliveryConfirmation":
        if (!orderId) {
          return next({
            statusCode: 400,
            message: "Order ID is required for delivery confirmation emails.",
          });
        }
        const deliveryOrder = await Order.findById(orderId);
        if (!deliveryOrder) {
          return next({ statusCode: 404, message: "Order not found." });
        }
        // Optional: allow custom delivery date in request body
        const { deliveryAdjustedDate, deliveryAdjustedDateString } =
          req.body as any;
        results = await sendOrderDeliveryConfirmation({
          order: deliveryOrder,
          recipients,
          deliveryAdjustedDate: deliveryAdjustedDate
            ? new Date(deliveryAdjustedDate)
            : undefined,
          deliveryAdjustedDateString,
        });
        break;

      case "signatureRequest":
        if (!orderId) {
          return next({
            statusCode: 400,
            message: "Order ID is required for signature request.",
          });
        }
        const signatureResult = await sendOrderCustomerSignatureRequest({
          orderId,
        });
        // Signature request sends to customer email, so map to all recipients
        // In practice, this should only be the customer, but we support multiple for consistency
        results = recipients.map((r) => ({
          recipient: r.email,
          success: signatureResult.success,
          error: signatureResult.error,
        }));
        break;

      case "survey":
        if (!orderId) {
          return next({
            statusCode: 400,
            message: "Order ID is required for survey emails.",
          });
        }
        const { surveyUrl: customSurveyUrl } = req.body as any;
        const surveyResult = await sendSurvey({
          orderId,
          surveyUrl: customSurveyUrl,
        });
        // Survey sends to customer email, so map to all recipients
        results = recipients.map((r) => ({
          recipient: r.email,
          success: surveyResult.success,
          error: surveyResult.error,
        }));
        break;

      case "custom":
        // Custom email - use custom subject and content
        if (!customSubject || !customContent?.html) {
          return next({
            statusCode: 400,
            message:
              "Custom subject and HTML content are required for custom emails.",
          });
        }

        const customResults = await Promise.allSettled(
          recipients.map(async (recipient) => {
            const result = await notificationManager.sendEmail({
              to: recipient.email,
              subject: customSubject,
              html: customContent.html,
              text: customContent.text,
            });

            return {
              recipient: recipient.email,
              success: result.success ?? false,
              error: result.error,
            };
          }),
        );

        results = customResults.map((result) =>
          result.status === "fulfilled"
            ? result.value
            : {
                recipient: "unknown",
                success: false,
                error: result.reason,
              },
        );
        break;

      default:
        // Generic order notification
        if (!orderId) {
          return next({
            statusCode: 400,
            message: "Order ID is required for order notifications.",
          });
        }

        // Check if it's a valid order notification type
        const validOrderNotificationTypes: OrderNotificationType[] = [
          "paymentRequest",
          "paymentReminder",
          "signatureRequest",
          "signatureRequestReminder",
          "survey",
          "surveyReminder",
          "pickupReminder",
          "agentsConfirmation",
          "agentsPickupConfirmation",
          "agentsDeliveryConfirmation",
          "customerConfirmation",
          "customerPickupConfirmation",
          "customerDeliveryConfirmation",
          "portalAdminPickupConfirmation",
          "portalAdminDeliveryConfirmation",
        ];

        if (
          !validOrderNotificationTypes.includes(
            emailType as OrderNotificationType,
          )
        ) {
          return next({
            statusCode: 400,
            message: `Invalid email type: ${emailType}`,
          });
        }

        // Use custom content if provided, otherwise use default behavior
        if (customSubject && customContent?.html) {
          const genericResults = await Promise.allSettled(
            recipients.map(async (recipient) => {
              const result = await sendOrderNotification({
                orderId,
                type: emailType as OrderNotificationType,
                email: {
                  to: recipient.email,
                  subject: customSubject,
                  html: customContent.html,
                  text: customContent.text,
                },
                recipientEmail: recipient.email,
              });

              return {
                recipient: recipient.email,
                success: result.success,
                error: result.success
                  ? undefined
                  : "Failed to send notification",
              };
            }),
          );

          results = genericResults.map((result) =>
            result.status === "fulfilled"
              ? result.value
              : {
                  recipient: "unknown",
                  success: false,
                  error: String(result.reason),
                },
          );
        } else {
          // For generic notifications without custom content, we need the order
          const genericOrder = await Order.findById(orderId);
          if (!genericOrder) {
            return next({ statusCode: 404, message: "Order not found." });
          }

          // For now, return an error suggesting custom content is needed
          return next({
            statusCode: 400,
            message: `Generic ${emailType} emails require custom subject and content. Please provide customSubject and customContent.`,
          });
        }
        break;
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    logger.info(`Manual email triggered: ${emailType}`, {
      emailType,
      totalRecipients: recipients.length,
      successCount,
      failureCount,
      orderId,
      quoteId,
      portalId,
    });

    res.status(200).json({
      success: successCount > 0,
      results,
      summary: {
        total: recipients.length,
        successful: successCount,
        failed: failureCount,
      },
    });
  } catch (error) {
    logger.error("Error in sendManualEmail:", error);
    next({
      statusCode: 500,
      message: "An error occurred while sending the email.",
    });
  }
};
