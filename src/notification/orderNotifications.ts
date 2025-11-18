/**
 * Order Notification Service
 *
 * Service for sending and tracking notifications related to orders
 */

import { logger } from "@/core/logger";
import { NotificationStatus } from "@/_global/enums";
import { Order } from "@/_global/models";
import { getNotificationManager } from "./index";
import { EmailOptions, SMSOptions, NotificationMetadata } from "./types";

export type OrderNotificationType =
  | "paymentRequest"
  | "paymentReminder"
  | "signatureRequest"
  | "signatureRequestReminder"
  | "survey"
  | "surveyReminder"
  | "pickupReminder"
  | "agentsConfirmation"
  | "agentsPickupConfirmation"
  | "agentsDeliveryConfirmation"
  | "customerConfirmation"
  | "customerPickupConfirmation"
  | "customerDeliveryConfirmation"
  | "portalAdminPickupConfirmation"
  | "portalAdminDeliveryConfirmation";

export interface OrderNotificationParams {
  orderId: string;
  type: OrderNotificationType;
  email?: EmailOptions;
  sms?: SMSOptions;
  recipientEmail?: string;
  recipientPhone?: string;
}

/**
 * Send notification for an order and update the order's notification tracking
 */
export async function sendOrderNotification(
  params: OrderNotificationParams,
): Promise<{ success: boolean; emailSent?: boolean; smsSent?: boolean }> {
  const { orderId, type, email, sms, recipientEmail, recipientPhone } = params;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      logger.error(`Order not found: ${orderId}`);
      return { success: false };
    }

    const notificationManager = getNotificationManager();

    // Prepare metadata
    const metadata: NotificationMetadata = {
      type: email ? "email" : sms ? "sms" : "email",
      channel: type,
      orderId: orderId,
      recipientEmail:
        recipientEmail ||
        (email
          ? Array.isArray(email.to)
            ? email.to[0]
            : email.to
          : undefined),
      recipientPhone: recipientPhone || sms?.to,
    };

    // Send notifications
    const result = await notificationManager.send({
      email,
      sms,
      metadata,
    });

    // Update order notification tracking
    const notificationUpdate: any = {
      status: NotificationStatus.Sent,
      sentAt: new Date(),
      recipientEmail: recipientEmail || email?.to,
    };

    // Handle failures
    if (email && result.email && !result.email.success) {
      notificationUpdate.status = NotificationStatus.Failed;
      notificationUpdate.failedAt = new Date();
    }

    if (sms && result.sms && !result.sms.success) {
      // If email succeeded but SMS failed, we still mark as sent
      // Otherwise, mark as failed
      if (!email || !result.email || !result.email.success) {
        notificationUpdate.status = NotificationStatus.Failed;
        notificationUpdate.failedAt = new Date();
      }
    }

    // Update the order's notification field
    await Order.findByIdAndUpdate(
      orderId,
      {
        [`notifications.${type}`]: notificationUpdate,
      },
      { new: true },
    );

    logger.info(`Order notification sent: ${type}`, {
      orderId,
      type,
      emailSuccess: result.email?.success,
      smsSuccess: result.sms?.success,
    });

    return {
      success:
        (email ? (result.email?.success ?? false) : true) &&
        (sms ? (result.sms?.success ?? false) : true),
      emailSent: result.email?.success ?? false,
      smsSent: result.sms?.success ?? false,
    };
  } catch (error) {
    logger.error(`Error sending order notification: ${type}`, {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Update order with failure status
    try {
      await Order.findByIdAndUpdate(
        orderId,
        {
          [`notifications.${type}`]: {
            status: NotificationStatus.Failed,
            failedAt: new Date(),
            recipientEmail: recipientEmail || email?.to,
          },
        },
        { new: true },
      );
    } catch (updateError) {
      logger.error("Failed to update order notification status:", updateError);
    }

    return { success: false };
  }
}

/**
 * Send email notification to order customer
 */
export async function sendOrderCustomerEmail(
  orderId: string,
  type: OrderNotificationType,
  subject: string,
  htmlContent: string,
  textContent?: string,
): Promise<boolean> {
  try {
    const order = await Order.findById(orderId);
    if (!order || !order.customer?.email) {
      logger.warn(
        `Cannot send customer email: Order ${orderId} not found or no email`,
      );
      return false;
    }

    const result = await sendOrderNotification({
      orderId,
      type,
      email: {
        to: order.customer.email,
        subject,
        html: htmlContent,
        text: textContent,
      },
      recipientEmail: order.customer.email,
    });

    return result.success;
  } catch (error) {
    logger.error(`Error sending customer email for order ${orderId}:`, error);
    return false;
  }
}

/**
 * Send SMS notification to order customer
 */
export async function sendOrderCustomerSMS(
  orderId: string,
  type: OrderNotificationType,
  message: string,
): Promise<boolean> {
  try {
    const order = await Order.findById(orderId);
    if (!order || !order.customer?.phoneMobile) {
      logger.warn(
        `Cannot send customer SMS: Order ${orderId} not found or no mobile phone`,
      );
      return false;
    }

    const result = await sendOrderNotification({
      orderId,
      type,
      sms: {
        to: order.customer.phoneMobile,
        message,
      },
      recipientPhone: order.customer.phoneMobile,
    });

    return result.success;
  } catch (error) {
    logger.error(`Error sending customer SMS for order ${orderId}:`, error);
    return false;
  }
}

/**
 * Send notification to order agents
 */
export async function sendOrderAgentNotification(
  orderId: string,
  type: OrderNotificationType,
  subject: string,
  htmlContent: string,
  textContent?: string,
  smsMessage?: string,
): Promise<boolean> {
  try {
    const order = await Order.findById(orderId);
    if (!order || !order.agents || order.agents.length === 0) {
      logger.warn(
        `Cannot send agent notification: Order ${orderId} has no agents`,
      );
      return false;
    }

    const agentEmails = order.agents
      .map((agent) => agent.email)
      .filter((email) => email) as string[];

    if (agentEmails.length === 0) {
      logger.warn(
        `Cannot send agent email: No agent emails found for order ${orderId}`,
      );
      return false;
    }

    const result = await sendOrderNotification({
      orderId,
      type,
      email: {
        to: agentEmails,
        subject,
        html: htmlContent,
        text: textContent,
      },
      sms: smsMessage
        ? {
            to: order.agents[0].email || "", // Note: This would need phone number from agents
            message: smsMessage,
          }
        : undefined,
      recipientEmail: agentEmails.join(", "),
    });

    return result.success;
  } catch (error) {
    logger.error(
      `Error sending agent notification for order ${orderId}:`,
      error,
    );
    return false;
  }
}
