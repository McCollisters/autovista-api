/**
 * Send White Glove Notification Service
 *
 * Sends notification when a white glove order is booked, with order details
 * and a link to the order in the portal.
 */

import { readFile } from "fs/promises";
import { join } from "path";
import Handlebars from "handlebars";
import { logger } from "@/core/logger";
import { IOrder } from "@/_global/models";
import { getNotificationManager } from "@/notification";
import { resolveTemplatePath } from "./utils/resolveTemplatePath";
import { getPortalBaseUrl } from "@/config/portalBaseUrl";
import { getPickupDatesString } from "./utils/getPickupDatesString";
import { getDeliveryDatesString } from "./utils/getDeliveryDatesString";
import { formatVehiclesHTML } from "./utils/formatVehiclesHTML";
import { formatTransportTypeLabelForOrder } from "@/_global/utils/formatTransportTypeLabel";

interface SendWhiteGloveNotificationParams {
  order: IOrder;
  recipientEmail?: string;
  recipientEmails?: string[];
  recipientName?: string;
}

const WHITE_GLOVE_BOOKING_RECIPIENTS = ["autoorders@mccollisters.com"];
const SENDER_EMAIL = "autotransport@mccollisters.com";
const SENDER_NAME = "McCollister's Auto Transport";

/**
 * Send white glove notification when an order is booked.
 */
export const sendWhiteGloveNotification = async (
  params: SendWhiteGloveNotificationParams,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { order, recipientEmail: customRecipientEmail, recipientEmails } =
      params;

    const recipients = (
      customRecipientEmail
        ? [customRecipientEmail]
        : recipientEmails?.length
          ? recipientEmails
          : WHITE_GLOVE_BOOKING_RECIPIENTS
    ).filter((email, index, list) => {
      const key = email.trim().toLowerCase();
      return key && list.findIndex((item) => item.trim().toLowerCase() === key) === index;
    });

    logger.info("Sending white glove notification", {
      orderId: order._id,
      refId: order.refId,
      recipients,
    });

    const subject = `White Glove Order Booked — #${order.refId}`;

    const distTemplatePath = join(
      process.cwd(),
      "dist/templates/white-glove.hbs",
    );
    const srcTemplatePath = join(
      process.cwd(),
      "src/templates/white-glove.hbs",
    );
    const isProduction = process.env.NODE_ENV === "production";
    const resolvedTemplatePath = await resolveTemplatePath(
      isProduction ? distTemplatePath : srcTemplatePath,
      isProduction ? srcTemplatePath : distTemplatePath,
    );
    const templateSource = await readFile(resolvedTemplatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    const pickupDates = getPickupDatesString(order);
    const deliveryDates = getDeliveryDatesString(order);
    const vehicles = formatVehiclesHTML(order.vehicles, true);
    const customerName = order.customer?.name || "";
    const customerEmail = order.customer?.email || "";
    const customerPhone = order.customer?.phone || "";

    const totalPrice =
      order.totalPricing?.totalWithCompanyTariffAndCommission ??
      order.totalPricing?.total ??
      0;
    const totalPriceDisplay = totalPrice > 0 ? totalPrice.toFixed(2) : null;

    const pickupContactName =
      order.origin?.contact?.name || order.origin?.contact?.companyName || "";
    const pickupPhone = order.origin?.contact?.phone || "";
    const pickupMobilePhone = order.origin?.contact?.phoneMobile || "";
    const pickupAddress = order.origin?.address?.address || "";
    const pickupCity = order.origin?.address?.city || "";
    const pickupState = order.origin?.address?.state || "";
    const pickupZip = order.origin?.address?.zip || "";

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

    const orderUrl = `${getPortalBaseUrl()}/order/${String(order._id)}`;
    const transportType = formatTransportTypeLabelForOrder(order);

    const html = template({
      refId: order.refId,
      reg: order.reg || "",
      orderUrl,
      transportType,
      customerName,
      customerEmail,
      customerPhone,
      pickupDates,
      deliveryDates,
      totalPriceDisplay,
      pickupContactName,
      pickupPhone,
      pickupMobilePhone,
      pickupAddress,
      pickupCity,
      pickupState,
      pickupZip,
      deliveryContactName,
      deliveryPhone,
      deliveryMobilePhone,
      deliveryAddress,
      deliveryCity,
      deliveryState,
      deliveryZip,
      vehicles,
    });

    const notificationManager = getNotificationManager();
    const failures: string[] = [];

    for (const recipientEmail of recipients) {
      const result = await notificationManager.sendEmail({
        to: recipientEmail,
        from: SENDER_EMAIL,
        fromName: SENDER_NAME,
        subject,
        html,
        replyTo: SENDER_EMAIL,
        templateName: "White Glove Notification",
      });

      if (result.success) {
        logger.info("White glove notification sent successfully", {
          orderId: order._id,
          refId: order.refId,
          recipientEmail,
        });
      } else {
        const error = result.error || "Failed to send white glove notification";
        failures.push(`${recipientEmail}: ${error}`);
        logger.error("Failed to send white glove notification", {
          orderId: order._id,
          refId: order.refId,
          recipientEmail,
          error,
        });
      }
    }

    if (failures.length === 0) {
      return { success: true };
    }

    return {
      success: false,
      error: failures.join("; "),
    };
  } catch (error) {
    logger.error("Error sending white glove notification:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
