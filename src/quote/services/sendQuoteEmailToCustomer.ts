import { readFile } from "fs/promises";
import path from "path";
import Handlebars from "handlebars";
import { getPortalBaseUrl } from "@/config/portalBaseUrl";
import { logger } from "@/core/logger";
import { getNotificationManager } from "@/notification";
import {
  formatPickupWindowBetweenLabel,
  parsePickupStartDateFromQuote,
} from "../utils/customerPickupDate";

const MC_LOGO =
  "https://autovista-assets.s3.us-west-1.amazonaws.com/MCC-Wordmark-RGB-Blue.png";

const formatTransportType = (transportType?: string | null) => {
  const normalized = String(transportType || "")
    .replace(/[_\s]+/g, "")
    .toUpperCase();
  if (normalized === "WHITEGLOVE") {
    return "White Glove";
  }
  if (normalized === "ENCLOSED") {
    return "Enclosed";
  }
  return "Open";
};

const formatVehiclesSummaryPlain = (vehicles: any[] = []) => {
  if (!vehicles.length) return "";
  return vehicles
    .map((v) => {
      const year = v.year ? `${String(v.year)} ` : "";
      const make = String(v.make || "").trim();
      const model = String(v.model || "").trim();
      return `${year}${make} ${model}`.trim();
    })
    .filter(Boolean)
    .join("; ");
};

export type SendQuoteEmailVariant = "confirmation" | "share";

export type SendQuoteEmailOptions = {
  variant?: SendQuoteEmailVariant;
};

const buildSharerDisplayName = (customer: any): string => {
  const first = String(customer?.firstName ?? "").trim();
  const last = String(customer?.lastName ?? "").trim();
  const fromParts = [first, last].filter(Boolean).join(" ").trim();
  if (fromParts) return fromParts;
  const full = String(
    customer?.name || customer?.customerFullName || "",
  ).trim();
  if (full) return full;
  return "Someone";
};

const getPricingTotal = (
  totals: any,
  transportType: string,
  levelKey: "one" | "three" | "five" | "seven",
) => {
  if (!totals) return 0;
  const normalized = transportType.replace(/[_\s]+/g, "").toUpperCase();
  if (normalized === "WHITEGLOVE") {
    return totals.whiteGlove || 0;
  }
  const typeKey = normalized === "ENCLOSED" ? "enclosed" : "open";
  const levelTotals = totals[levelKey];
  return levelTotals?.[typeKey]?.total || levelTotals?.total || 0;
};

/**
 * Sends the quote details email to a recipient (e.g. customer).
 * Quote can be a lean object or Mongoose document.
 * Use variant "share" when someone emails the quote to another address from the app.
 */
export const sendQuoteEmailToCustomer = async (
  quote: any,
  recipientEmail: string,
  options?: SendQuoteEmailOptions,
): Promise<{ success: boolean; error?: string }> => {
  const quoteId = quote?._id?.toString?.() || quote?._id;
  const variant: SendQuoteEmailVariant = options?.variant ?? "confirmation";
  const isShareRecipient = variant === "share";

  try {
    const recipientName =
      quote?.customer?.name || quote?.customer?.customerFullName || "Customer";
    const firstName =
      (quote?.customer as any)?.firstName?.trim?.() ||
      String(recipientName).split(" ")[0] ||
      "Customer";
    const sharerName = buildSharerDisplayName(quote?.customer);
    const code = String(
      quote?.customer?.quoteConfirmationCode ||
        quote?.customer?.trackingCode ||
        quote?.refId ||
        quote?.uniqueId ||
        quote?._id,
    );
    const encodedCode = encodeURIComponent(code);
    const encodedEmail = encodeURIComponent(recipientEmail);
    const normalizedBaseUrl = getPortalBaseUrl();
    const bookUrl = `${normalizedBaseUrl}/public/quote/${quote._id}/book?code=${encodedCode}&email=${encodedEmail}`;

    const refIdDisplay = String(
      quote?.refId ?? quote?.uniqueId ?? code,
    );

    const pickupLocation =
      quote?.origin?.validated || quote?.origin?.userInput || "";
    const deliveryLocation =
      quote?.destination?.validated || quote?.destination?.userInput || "";
    const transportType = formatTransportType(quote?.transportType);
    const transportNormalized = String(quote?.transportType || "")
      .replace(/[_\s]+/g, "")
      .toUpperCase();
    const isWhiteGlove = transportNormalized === "WHITEGLOVE";

    const vehiclesSummary =
      formatVehiclesSummaryPlain(quote?.vehicles || []) || "—";
    const totals = quote?.totalPricing?.totals;

    const oneday = Math.ceil(getPricingTotal(totals, transportType, "one"));
    const threeday = Math.ceil(getPricingTotal(totals, transportType, "three"));
    const fiveday = Math.ceil(getPricingTotal(totals, transportType, "five"));
    const sevenday = Math.ceil(getPricingTotal(totals, transportType, "seven"));
    const whiteGlovePrice = Math.ceil(
      (totals as any)?.whiteGlove || 0,
    );

    const priceOrDash = (n: number) => (n > 0 ? `$${n}` : "—");
    const priceOne = priceOrDash(oneday);
    const priceThree = priceOrDash(threeday);
    const priceFive = priceOrDash(fiveday);
    const priceSeven = priceOrDash(sevenday);
    const whiteGlovePriceDisplay = priceOrDash(whiteGlovePrice);

    const pickupStart = parsePickupStartDateFromQuote(quote);
    const hasPickupStart = pickupStart != null;

    const pickupLabelOne = hasPickupStart
      ? formatPickupWindowBetweenLabel(pickupStart!, 1)
      : "Selected date + 1 day";
    const pickupLabelThree = hasPickupStart
      ? formatPickupWindowBetweenLabel(pickupStart!, 3)
      : "Selected date + 3 days";
    const pickupLabelFive = hasPickupStart
      ? formatPickupWindowBetweenLabel(pickupStart!, 5)
      : "Selected date + 5 days";
    const pickupLabelSeven = hasPickupStart
      ? formatPickupWindowBetweenLabel(pickupStart!, 7)
      : "Selected date + 7 days";

    const templatePath = path.join(
      process.cwd(),
      "src/templates/customer-quote.hbs",
    );
    const templateSource = await readFile(templatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    const emailLogo = MC_LOGO;
    const html = template({
      firstName,
      sharerName,
      isShareRecipient,
      code,
      bookUrl,
      refIdDisplay,
      pickupLocation,
      deliveryLocation,
      transportType,
      vehiclesSummary,
      isWhiteGlove,
      whiteGlovePriceDisplay,
      priceOne,
      priceThree,
      priceFive,
      priceSeven,
      pickupLabelOne,
      pickupLabelThree,
      pickupLabelFive,
      pickupLabelSeven,
      logo: emailLogo,
    });

    const notificationManager = getNotificationManager();
    const subject = isShareRecipient
      ? "A McCollister's auto transport quote was shared with you"
      : "Your McCollister's Auto Transport Quote";

    const result = await notificationManager.sendEmail({
      to: recipientEmail,
      subject,
      html,
      from: "autologistics@mccollisters.com",
      fromName: "McCollister's Auto Logistics",
      replyTo: "autologistics@mccollisters.com",
      templateName: "Customer Quote",
    });

    if (!result.success) {
      logger.error("Failed to send customer quote email", {
        quoteId,
        recipientEmail,
        error: result.error,
      });
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (error) {
    logger.error("Error sending customer quote email", {
      error: error instanceof Error ? error.message : String(error),
      quoteId,
      recipientEmail,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
