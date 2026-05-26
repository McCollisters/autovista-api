/**
 * Send Order Customer Public New Notification
 *
 * Sends order confirmation email to customer
 */

import { readFile } from "fs/promises";
import path from "path";
import Handlebars from "handlebars";
import { getPortalBaseUrl } from "@/config/portalBaseUrl";
import { logger } from "@/core/logger";
import { PaymentType, TransportType } from "@/_global/enums";
import { IOrder, Portal } from "@/_global/models";
import { sendOrderNotification } from "@/notification/orderNotifications";
import { formatVehiclesPlain } from "./utils/formatVehiclesPlain";
import { formatOrderStatusDetailEmailDates } from "./utils/formatOrderStatusDetailEmailDates";
import { resolveTemplatePath } from "./utils/resolveTemplatePath";
import { resolveOrderCustomerEmailForTracking } from "../utils/resolveOrderCustomerEmailForTracking";

const CUSTOMER_ORDER_EMAIL_FROM = "autotransport@mccollisters.com";
const CUSTOMER_ORDER_EMAIL_FROM_NAME = "McCollister's Auto Transport";

type LocationKind = "pickup" | "delivery";

type LocationDetails = {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  mobilePhone: string;
  alternativePhone: string;
  addressLine1: string;
  addressLine1Display: string;
  addressLine2Display: string;
  notes: string;
};

function recipientFirstNameFromName(name: string): string {
  const t = String(name ?? "").trim();
  if (!t) return "there";
  const first = t.split(/\s+/)[0];
  return first || "there";
}

/** Display name for "X shared this with you" (order customer / booker). */
function buildSharerDisplayName(customer: IOrder["customer"]): string {
  const c = customer as Record<string, unknown> | undefined;
  const first = String(c?.firstName ?? "").trim();
  const last = String(c?.lastName ?? "").trim();
  const fromParts = [first, last].filter(Boolean).join(" ").trim();
  if (fromParts) return fromParts;
  const full = String(
    c?.name || c?.customerFullName || "",
  ).trim();
  if (full) return full;
  return "Someone";
}

function transportTypeDisplayLabel(orderTransportType?: string): string {
  const t = String(orderTransportType || "").toLowerCase();
  if (t === TransportType.WhiteGlove) return "White Glove";
  if (t === TransportType.Enclosed) return "Enclosed";
  return "Open";
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function formatCityStateZip(city: string, state: string, zip: string): string {
  const cityState = [city, state].filter(Boolean).join(", ");
  return [cityState, zip].filter(Boolean).join(" ").trim();
}

function buildLocationDetails(order: IOrder, kind: LocationKind): LocationDetails {
  const orderData = order as unknown as {
    pickup?: Record<string, unknown>;
    delivery?: Record<string, unknown>;
    origin?: {
      contact?: Record<string, unknown>;
      address?: Record<string, unknown>;
      notes?: unknown;
    };
    destination?: {
      contact?: Record<string, unknown>;
      address?: Record<string, unknown>;
      notes?: unknown;
    };
  };
  const detail =
    kind === "pickup" ? (orderData.pickup ?? {}) : (orderData.delivery ?? {});
  const location =
    kind === "pickup" ? (orderData.origin ?? {}) : (orderData.destination ?? {});
  const contact = location.contact ?? {};
  const address = location.address ?? {};

  const businessName = firstNonEmpty(
    kind === "pickup" ? detail.pickupBusinessName : detail.deliveryBusinessName,
    contact.companyName,
  );
  const contactName = firstNonEmpty(
    kind === "pickup" ? detail.pickupContactName : detail.deliveryContactName,
    contact.name,
  );
  const email = firstNonEmpty(
    kind === "pickup" ? detail.pickupEmail : detail.deliveryEmail,
    contact.email,
  );
  const phone = firstNonEmpty(
    kind === "pickup" ? detail.pickupPhone : detail.deliveryPhone,
    contact.phone,
  );
  const mobilePhone = firstNonEmpty(
    kind === "pickup" ? detail.pickupMobilePhone : detail.deliveryMobilePhone,
    contact.phoneMobile,
  );
  const alternativePhone = firstNonEmpty(
    kind === "pickup" ? detail.pickupAltPhone : detail.deliveryAltPhone,
    contact.phoneAlt,
  );
  const addressLine1 = firstNonEmpty(
    kind === "pickup" ? detail.pickupAddress : detail.deliveryAddress,
    address.address,
  );
  const city = firstNonEmpty(
    kind === "pickup" ? detail.pickupCity : detail.deliveryCity,
    address.city,
  );
  const state = firstNonEmpty(
    kind === "pickup" ? detail.pickupState : detail.deliveryState,
    address.state,
  );
  const zip = firstNonEmpty(
    kind === "pickup" ? detail.pickupZip : detail.deliveryZip,
    address.zip,
  );
  const notes = firstNonEmpty(
    kind === "pickup" ? detail.pickupNotes : detail.deliveryNotes,
    location.notes,
  );
  const addressLine2Display = formatCityStateZip(city, state, zip);

  return {
    businessName,
    contactName,
    email,
    phone,
    mobilePhone,
    alternativePhone,
    addressLine1,
    addressLine1Display: addressLine1 || "—",
    addressLine2Display,
    notes,
  };
}

const COD_PAYMENT_HOSTED_URL =
  "https://www.convergepay.com/hosted-payments?ssl_txn_auth_token=YtH5YU2ER7alJZ%2FD73aAegAAAZW6CTk1";

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
export type SendOrderCustomerEmailVariant = "confirmation" | "share";

export async function sendOrderCustomerPublicNew(
  order: IOrder,
  overrides: {
    recipientEmail?: string;
    recipientName?: string;
    /** Use "share" when emailing a third party from Share via email (not the booker). */
    variant?: SendOrderCustomerEmailVariant;
  } = {},
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

    let logo: string | undefined;
    let companyName = "";

    const portalIdString = String(order.portalId);
    const isSirva = SIRVA_PORTAL_IDS.includes(portalIdString);

    // Determine template path
    const templateFileName = isSirva
      ? "customer-order-sirva.hbs"
      : "customer-order-new.hbs";
    const templatePath = isSirva
      ? path.join(process.cwd(), "dist/templates/customer-order-sirva.hbs")
      : path.join(process.cwd(), "dist/templates/customer-order-new.hbs");
    const resolvedTemplatePath = await resolveTemplatePath(
      templatePath,
      path.join(process.cwd(), "src/templates", templateFileName),
    );

    const mclogo =
      "https://autovista-assets.s3.us-west-1.amazonaws.com/MCC-Wordmark-RGB-Blue.png";

    // Handle special company names
    if (portal.companyName === "Move Easy") {
      companyName = "MoveEasy and";
      logo = mclogo;
    } else if (portal.companyName === "AutoTrader.com") {
      companyName = "AutoTrader.com and";
      logo = mclogo;
    }

    const recipientEmail = overrides.recipientEmail || order.customer?.email;

    if (!recipientEmail) {
      logger.warn(
        `Cannot send customer order email: No recipient email provided for order ${order._id}`,
      );
      return { success: false, error: "Recipient email is required" };
    }

    const variant: SendOrderCustomerEmailVariant =
      overrides.variant ?? "confirmation";
    const isShareRecipient = variant === "share";

    const recipientName =
      overrides.recipientName || order.customer?.name || "Customer";
    const recipientFirstName = recipientFirstNameFromName(recipientName);
    const sharerName = buildSharerDisplayName(order.customer);

    const subject = isShareRecipient
      ? "A McCollister's auto transport order was shared with you"
      : "Your McCollister's Auto Transport Order Is Confirmed";

    const pickupCity = order.origin?.address?.city || "";
    const pickupState = order.origin?.address?.state || "";

    const deliveryCity = order.destination?.address?.city || "";
    const deliveryState = order.destination?.address?.state || "";

    const isCOD = order.paymentType === PaymentType.Cod;
    const {
      pickupDetailLabel,
      pickupDetailDisplay,
      deliveryDetailLabel,
      deliveryDetailDisplay,
    } = formatOrderStatusDetailEmailDates(order);
    const orderStatusOverride = process.env.ORDER_STATUS_BASE_URL?.trim();
    const normalizedBaseUrl = orderStatusOverride
      ? orderStatusOverride.replace(/\/$/, "")
      : getPortalBaseUrl();
    const customerEmailForStatusLink =
      resolveOrderCustomerEmailForTracking(order) ||
      String(order.customer?.email || "").trim();
    const emailForStatusUrl = isShareRecipient
      ? customerEmailForStatusLink || recipientEmail
      : recipientEmail;
    const orderStatusUrl = `${normalizedBaseUrl}/public/order-status?email=${encodeURIComponent(
      emailForStatusUrl,
    )}`;
    const faqUrl = `${normalizedBaseUrl}/public/quote`;

    const pickupLocationShort =
      [pickupCity, pickupState]
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .join(", ") || "TBD";
    const deliveryLocationShort =
      [deliveryCity, deliveryState]
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .join(", ") || "TBD";

    const transportTypeDisplay = transportTypeDisplayLabel(order.transportType);

    const vehiclesPlain = formatVehiclesPlain(order.vehicles);
    const pickupDetails = buildLocationDetails(order, "pickup");
    const deliveryDetails = buildLocationDetails(order, "delivery");

    const orderId = String(order._id);
    /** Read-only terms page; customers accept during public booking */
    const termsUrl = `${normalizedBaseUrl}/public/terms`;

    // Load and compile template
    const templateSource = await readFile(resolvedTemplatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    const showPaymentSection = isCOD && !isShareRecipient;

    // Prepare template data
    const html = template({
      logo: logo || mclogo,
      companyName,
      mclogo,
      pickupLocationShort,
      deliveryLocationShort,
      pickupDetailLabel,
      pickupDetailDisplay,
      deliveryDetailLabel,
      deliveryDetailDisplay,
      pickupDetails,
      deliveryDetails,
      transportTypeDisplay,
      vehiclesPlain,
      refId: order.refId,
      termsUrl,
      orderStatusUrl,
      faqUrl,
      paymentUrl: COD_PAYMENT_HOSTED_URL,
      showPaymentSection,
      sectionNextNumber: showPaymentSection ? "6" : "5",
      sectionNotesNumber: showPaymentSection ? "7" : "6",
      recipientName,
      recipientFirstName,
      isShareRecipient,
      sharerName,
    });

    // Send email using order notification system
    const result = await sendOrderNotification({
      orderId: orderId,
      type: "customerConfirmation",
      email: {
        to: recipientEmail,
        subject,
        html,
        from: CUSTOMER_ORDER_EMAIL_FROM,
        fromName: CUSTOMER_ORDER_EMAIL_FROM_NAME,
        replyTo: CUSTOMER_ORDER_EMAIL_FROM,
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
