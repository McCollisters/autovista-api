/**
 * Send Order Customer Public New Notification
 *
 * Sends order confirmation email to customer
 */

import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import Handlebars from "handlebars";
import { logger } from "@/core/logger";
import { IOrder, Portal } from "@/_global/models";
import { sendOrderNotification } from "@/notification/orderNotifications";
import { getPickupDatesString } from "./utils/getPickupDatesString";
import { getDeliveryDatesString } from "./utils/getDeliveryDatesString";
import { formatVehiclesHTML } from "./utils/formatVehiclesHTML";
import { DateTime } from "luxon";
import { MMI_PORTALS } from "@/_global/constants/portalIds";
import { resolveTemplatePath } from "./utils/resolveTemplatePath";

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
  overrides: { recipientEmail?: string; recipientName?: string } = {},
): Promise<{ success: boolean; error?: string }> {
  if (!order) {
    logger.warn("Cannot send customer order email: Order is null");
    return { success: false, error: "Order is required" };
  }

  try {
    // Get portal information
    const portal = await Portal.findById(order.portalId);
    if (!portal) {
      logger.warn(`Portal not found for order: ${order._id}`);
      return { success: false, error: "Portal not found" };
    }

    // Get email template values
    const { getEmailTemplate } = await import(
      "@/email/services/getEmailTemplate"
    );
    const emailTemplate = await getEmailTemplate("Customer Order");

    const senderEmail = emailTemplate.senderEmail;
    const senderName = emailTemplate.senderName;

    let logo: string | undefined;
    let companyName = "";

    const portalIdString = String(order.portalId);
    const isSirva = SIRVA_PORTAL_IDS.includes(portalIdString);
    const isMMI = MMI_PORTALS.includes(
      portalIdString as (typeof MMI_PORTALS)[number],
    );

    // Determine template path
    const templatePath = isSirva
      ? path.join(__dirname, "../../templates/customer-order-sirva.hbs")
      : path.join(__dirname, "../../templates/customer-order-new.hbs");
    const resolvedTemplatePath = await resolveTemplatePath(
      templatePath,
      path.join(
        process.cwd(),
        "src/templates",
        isSirva ? "customer-order-sirva.hbs" : "customer-order-new.hbs",
      ),
    );

    const mclogo =
      "https://res.cloudinary.com/dq27r8cov/image/upload/v1616097775/McCollister%27s/mccollisters-auto-logistics.png";

    // Handle special company logos
    if (portal.companyName === "Move Easy") {
      companyName = "MoveEasy and";
      logo =
        "https://res.cloudinary.com/dq27r8cov/image/upload/v1616098696/McCollister%27s/moveeasy-logo.png";
    } else if (portal.companyName === "AutoTrader.com") {
      companyName = "AutoTrader.com and";
      logo =
        "https://res.cloudinary.com/dq27r8cov/image/upload/v1631829206/McCollister%27s/autotrader-logo.png";
    }

    const recipientEmail = overrides.recipientEmail || order.customer?.email;

    if (!recipientEmail) {
      logger.warn(
        `Cannot send customer order email: No recipient email provided for order ${order._id}`,
      );
      return { success: false, error: "Recipient email is required" };
    }

    const recipientName =
      overrides.recipientName || order.customer?.name || "Customer";
    const subject =
      emailTemplate.subject ||
      `Your Vehicle Transport Confirmation - Order #${order.refId}`;

    // Extract address information
    const pickupAddress = order.origin?.address?.address || "";
    const pickupCity = order.origin?.address?.city || "";
    const pickupState = order.origin?.address?.state || "";
    const pickupZip = order.origin?.address?.zip || "";

    const deliveryAddress = order.destination?.address?.address || "";
    const deliveryCity = order.destination?.address?.city || "";
    const deliveryState = order.destination?.address?.state || "";
    const deliveryZip = order.destination?.address?.zip || "";

    const formatSingleDate = (date?: Date | string | null) => {
      if (!date) return "TBD";
      return DateTime.fromJSDate(new Date(date))
        .setZone("America/New_York")
        .toLocaleString(DateTime.DATE_MED);
    };
    const isWhiteGlove = order.transportType === "WHITEGLOVE";
    const isCOD = order.paymentType === "COD";
    const pickupDates = getPickupDatesString(order);
    const deliveryDates = getDeliveryDatesString(order);
    const pickupDatesLabel = "Estimated Pickup:";
    const deliveryDatesLabel = "Estimated Delivery:";
    const pickupDatesValue = isWhiteGlove
      ? formatSingleDate(
          order.schedule?.pickupEstimated?.[0] ||
            order.schedule?.pickupSelected ||
            null,
        )
      : pickupDates;
    const deliveryDatesValue = isWhiteGlove
      ? formatSingleDate(order.schedule?.deliveryEstimated?.[0] || null)
      : deliveryDates;
    const totalPrice =
      order.totalPricing?.totalWithCompanyTariffAndCommission ||
      order.totalPricing?.totalPortal ||
      0;
    const totalPriceDisplay = Math.ceil(totalPrice);
    const paymentInstructionsHtml = isCOD
      ? `
        <p style="box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; letter-spacing: 0.5px; line-height: 1.4; margin-bottom: 10px;">
          <strong>Payment Required (COD):</strong> We must receive payment in full before scheduling pickup. Please do not pay the driver directly.
        </p>
        <p style="box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; letter-spacing: 0.5px; line-height: 1.4; margin-bottom: 10px;">
          Pay online here:
          <a href="https://www.convergepay.com/hosted-payments?ssl_txn_auth_token=YtH5YU2ER7alJZ%2FD73aAegAAAZW6CTk1">https://www.convergepay.com/hosted-payments</a>
        </p>
        <p style="box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; letter-spacing: 0.5px; line-height: 1.4; margin-bottom: 10px;">
          Enter the total of <strong>$${totalPriceDisplay}</strong> and use order # <strong>${order.refId}</strong>.
        </p>
        <p style="box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; letter-spacing: 0.5px; line-height: 1.4; margin-bottom: 10px;">
          Payment must be received at least three (3) business days before pickup. Payments made later may require rescheduling.
        </p>
        <p style="box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; letter-spacing: 0.5px; line-height: 1.4; margin-bottom: 10px;">
          A 3% credit card surcharge applies (debit cards are 1% + $0.25). The surcharge appears as a separate line item on your receipt.
        </p>
        <p style="box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; letter-spacing: 0.5px; line-height: 1.4; margin-bottom: 10px;">
          If you do not receive a payment confirmation email after submitting, please do not retry. Contact us for assistance.
        </p>
      `
      : "";
    const baseUrl =
      process.env.BASE_URL || "https://autovista.mccollisters.com";
    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
    const orderStatusUrl = `${normalizedBaseUrl}/public/order-status`;
    const trackingHtml = isMMI
      ? ""
      : `<tr>
            <td valign="top" style="width: 600px;padding-bottom: 15px;margin: 0 auto;">
              <p style="box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; letter-spacing: 0.5px; line-height: 1.4; margin: 0;">
                <strong>The below link will bring you to our customer portal where you can log in and follow the progress
                of your transport:</strong><br />
                <a href="${orderStatusUrl}">${orderStatusUrl}</a>
              </p>
            </td>
          </tr>`;
    const smallTextHtml = isMMI
      ? `<tr>
            <td valign="top" style="width: 600px; padding-bottom: 15px;margin: 0 auto;">
              <p style="box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; letter-spacing: 0.5px; line-height: 1.4; margin: 0; padding-bottom: 15px; font-size: 12px; font-style: italic;">**Please
                note that you must be available during the entire spread for the dates above. If you are unable to
                release or accept your vehicle(s) during the entire spread, you may have a delegate assigned to
                release or accept your vehicle(s) on your behalf. Please provide us with the name and contact
                information for your assigned delegate ASAP.</p>
              <p style="box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; letter-spacing: 0.5px; line-height: 1.4; margin: 0; padding-bottom: 15px; font-size: 12px; font-style: italic;">If you are not available and do not have anyone to act as your delegate, then we will need to go back to the account and ask for coverage of potential terminal storage and re-delivery fees due to no one being available during the required spreads. <u>Please be aware that denial by the account may result in required terminal fees to be paid by you directly out of pocket prior to your vehicle(s) being delivered as the assigned driver cannot hold your vehicle(s) on the truck.</u></p>
              <p style="box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; letter-spacing: 0.5px; line-height: 1.4; margin: 0; font-size: 12px; font-style: italic;">You
                or your assigned delegate will be notified a day in advance of the actual pick up and delivery date
                and provided an ESTIMATED window of arrival for the driver. This is only an estimate and subject to
                change as you must be prepared for the driver to arrive from 7am until before dark on the day of
                pick up or delivery. We try our best to try to provide accurate estimates but due to uncontrollable
                circumstances such as traffic, weather, mechanical issue, prior scheduling delays experienced by
                the driver, etc. they are subject to change.</p>
            </td>
          </tr>`
      : `<tr>
            <td valign="top" style="width: 600px; padding-bottom: 15px;margin: 0 auto;">
              <p style="box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; letter-spacing: 0.5px; line-height: 1.4; margin: 0; padding-bottom: 15px; font-size: 12px; font-style: italic;">**Please
                note that you must be available during the entire spread for the dates above. If you are unable to
                release or accept your vehicle(s) during the entire spread, you may have a delegate assigned to
                release or accept your vehicle(s) on your behalf. Please provide us with the name and contact
                information for your assigned delegate ASAP.</p>
              <p style="box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; letter-spacing: 0.5px; line-height: 1.4; margin: 0; padding-bottom: 15px; font-size: 12px; font-style: italic;">If you are not available and do not have anyone to act as your delegate, then we will need to ask for coverage of potential terminal storage and re-delivery fees due to no one being available during the required spreads.</p>
              <p style="box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; letter-spacing: 0.5px; line-height: 1.4; margin: 0; font-size: 12px; font-style: italic;">You
                or your assigned delegate will be notified a day in advance of the actual pick up and delivery date
                and provided an ESTIMATED window of arrival for the driver. This is only an estimate and subject to
                change as you must be prepared for the driver to arrive from 7am until before dark on the day of
                pick up or delivery. We try our best to try to provide accurate estimates but due to uncontrollable
                circumstances such as traffic, weather, mechanical issue, prior scheduling delays experienced by
                the driver, etc. they are subject to change.</p>
            </td>
          </tr>`;

    // Format transport type
    const transportType =
      order.transportType?.charAt(0).toUpperCase() +
        order.transportType?.slice(1) || "Open";

    // Format vehicles HTML with pricing
    const vehicles = formatVehiclesHTML(order.vehicles, false);

    // Build terms URL
    const orderId = String(order._id);
    const termsUrl = `${normalizedBaseUrl}/terms/${orderId}/${order.refId}`;

    // Load and compile template
    const templateSource = await readFile(resolvedTemplatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    // Prepare template data
    const html = template({
      logo: logo || mclogo,
      companyName,
      mclogo,
      pickupDatesLabel,
      pickupDatesValue,
      pickupAddress,
      pickupCity,
      pickupState,
      pickupZip,
      deliveryDatesLabel,
      deliveryDatesValue,
      deliveryAddress,
      deliveryCity,
      deliveryState,
      deliveryZip,
      transportType,
      vehicles,
      totalPrice: totalPriceDisplay,
      paymentInstructionsHtml,
      trackingHtml,
      smallTextHtml,
      refId: order.refId,
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
        refId: order.refId,
        recipientEmail,
        isSirva,
      });
    } else {
      logger.error("Failed to send customer order email", {
        orderId: order._id,
        refId: order.refId,
        recipientEmail,
      });
    }

    return {
      success: result.success,
    };
  } catch (error) {
    logger.error("Error in sendOrderCustomerPublicNew:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
