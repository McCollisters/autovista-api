import express from "express";
import { readFile } from "fs/promises";
import path from "path";
import Handlebars from "handlebars";
import { Quote, Portal } from "@/_global/models";
import { logger } from "@/core/logger";
import { getNotificationManager } from "@/notification";

const MC_LOGO =
  "https://res.cloudinary.com/dq27r8cov/image/upload/v1616097775/McCollister%27s/mccollisters-auto-logistics.png";

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

const formatVehiclesHtml = (vehicles: any[] = []) => {
  if (!vehicles.length) {
    return "<p>No vehicles listed.</p>";
  }
  const items = vehicles
    .map((vehicle) => {
      const year = vehicle.year ? `${vehicle.year} ` : "";
      const make = vehicle.make || "";
      const model = vehicle.model || "";
      const vin = vehicle.vin ? `<br />VIN: ${vehicle.vin}` : "";
      const inoperable = vehicle.isInoperable ? "<br /><em>Inoperable</em>" : "";
      return `<li><strong>${year}${make} ${model}</strong>${vin}${inoperable}</li>`;
    })
    .join("");
  return `<ul>${items}</ul>`;
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

export const sendQuoteCustomerEmail = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { quoteId } = req.params;
    const recipientEmail = String(req.body?.email || "").trim();

    if (!recipientEmail) {
      return next({ statusCode: 400, message: "Recipient email is required." });
    }

    const quote = await Quote.findById(quoteId).lean();
    if (!quote) {
      return next({ statusCode: 404, message: "Quote not found." });
    }

    const portal = quote.portalId
      ? await Portal.findById(quote.portalId).lean()
      : null;

    const recipientName =
      quote.customer?.name ||
      quote.customer?.customerFullName ||
      "Customer";
    const firstName = String(recipientName).split(" ")[0] || "Customer";
    const code = String(
      quote.customer?.quoteConfirmationCode ||
        quote.customer?.trackingCode ||
        quote.refId ||
        quote.uniqueId ||
        quote._id,
    );
    const encodedCode = encodeURIComponent(code);
    const encodedEmail = encodeURIComponent(recipientEmail);
    const url = `https://autovista.mccollisters.com/public/quote/${quote._id}?code=${encodedCode}&email=${encodedEmail}`;

    const pickupLocation =
      quote.origin?.validated || quote.origin?.userInput || "";
    const deliveryLocation =
      quote.destination?.validated || quote.destination?.userInput || "";
    const transportType = formatTransportType(quote.transportType);
    const vehicles = formatVehiclesHtml(quote.vehicles || []);
    const totals = quote.totalPricing?.totals;

    const oneday = Math.ceil(
      getPricingTotal(totals, transportType, "one"),
    );
    const threeday = Math.ceil(
      getPricingTotal(totals, transportType, "three"),
    );
    const fiveday = Math.ceil(
      getPricingTotal(totals, transportType, "five"),
    );
    const sevenday = Math.ceil(
      getPricingTotal(totals, transportType, "seven"),
    );

    const templatePath = path.join(
      process.cwd(),
      "src/templates/customer-quote.hbs",
    );
    const templateSource = await readFile(templatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    const html = template({
      firstName,
      code,
      url,
      pickupLocation,
      deliveryLocation,
      transportType,
      vehicles,
      oneday,
      threeday,
      fiveday,
      sevenday,
      companyName: portal?.companyName || "",
      logo: portal?.logo || MC_LOGO,
      logo2: MC_LOGO,
    });

    const notificationManager = getNotificationManager();
    const subject = `Your Requested Auto Transport Quote #${code}`;

    const result = await notificationManager.sendEmail({
      to: recipientEmail,
      subject,
      html,
      from: "autologistics@mccollisters.com",
      fromName: "McCollister's AutoLogistics",
      replyTo: "autologistics@mccollisters.com",
      templateName: "Customer Quote",
    });

    if (!result.success) {
      logger.error("Failed to send customer quote email", {
        quoteId,
        recipientEmail,
        error: result.error,
      });
      return next({
        statusCode: 500,
        message: "Failed to send quote email.",
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Error sending customer quote email", {
      error: error instanceof Error ? error.message : String(error),
      quoteId: req.params?.quoteId,
    });
    next(error);
  }
};
