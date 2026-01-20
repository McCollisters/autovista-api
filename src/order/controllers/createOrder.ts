import express from "express";
import { Order, Quote, Portal, User, Settings } from "@/_global/models";
import {
  Status,
  TransportType,
  ServiceLevelOption,
  PaymentType,
} from "../../_global/enums";
import { logger } from "@/core/logger";
import { geocode } from "../../_global/utils/geocode";
import { formatPhoneNumber } from "../../_global/utils/formatPhoneNumber";
import { getDateRanges } from "../../_global/utils/getDateRanges";
import { sendPartialOrderToSuper } from "../integrations/sendPartialOrderToSuper";
import { sendWhiteGloveNotification } from "../notifications/sendWhiteGloveNotification";
import { sendOrderAgentEmail } from "../notifications/sendOrderAgent";
import { sendMMIOrderNotification } from "../notifications/sendMMIOrderNotification";
import { sendCODPaymentRequest } from "../notifications/sendCODPaymentRequest";
import { sendOrderCustomerPublicNew } from "../notifications/sendOrderCustomerPublicNew";
import { MMI_PORTALS } from "../../_global/constants/portalIds";
import { resolveId } from "@/_global/utils/resolveId";

const mergeNotificationEmails = (existing: any[], agents: any[]) => {
  const byEmail = new Map<string, any>();

  existing.forEach((entry) => {
    const email = String(entry?.email || "")
      .trim()
      .toLowerCase();
    if (!email) return;
    byEmail.set(email, { ...entry });
  });

  agents.forEach((agent) => {
    const email = String(agent?.email || "")
      .trim()
      .toLowerCase();
    if (!email) return;
    const existingEntry = byEmail.get(email) || {};
    byEmail.set(email, {
      ...existingEntry,
      email: existingEntry.email || agent.email,
      name: agent.name || existingEntry.name,
      pickup: Boolean(existingEntry.pickup || agent.pickup),
      delivery: Boolean(existingEntry.delivery || agent.delivery),
    });
  });

  return Array.from(byEmail.values());
};

export const createOrder = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { ...filteredData } = req.body;

    let {
      quotes,
      quoteId,
      portalId,
      customer,
      customerFirstName,
      customerLastName,
      customerFullName,
      customerEmail,
      customerPrimaryPhone,
      customerAltPhone,
      customerPrimaryPhoneIsMobile,
      customerAltPhoneIsMobile,
      reg,
      serviceLevel,
      paymentType,
      agents,
      pickupStartDate,
      pickupLocationType,
      pickupAddress,
      pickupCity,
      pickupState,
      pickupZip,
      pickupBusinessName,
      pickupContactName,
      pickupEmail,
      pickupPrimaryPhone,
      pickupAltPhone,
      pickupPrimaryPhoneIsMobile,
      pickupAltPhoneIsMobile,
      pickupNotes,
      deliveryLocationType,
      deliveryAddress,
      deliveryCity,
      deliveryState,
      deliveryZip,
      deliveryBusinessName,
      deliveryContactName,
      deliveryEmail,
      deliveryPrimaryPhone,
      deliveryAltPhone,
      deliveryPrimaryPhoneIsMobile,
      deliveryAltPhoneIsMobile,
      deliveryNotes,
      sirvaNonDomestic,
      moveType,
      transportType,
    } = filteredData;

    pickupNotes = pickupNotes
      ? `${pickupNotes} / MUST have signed BOL at pickup`
      : null;
    deliveryNotes = deliveryNotes
      ? `${deliveryNotes} / MUST have signed BOL at delivery`
      : null;

    // Initialize agents array if not provided
    if (!agents) {
      agents = [];
    }

    let payment = PaymentType.Billing;

    quoteId = resolveId(quoteId);
    portalId = resolveId(portalId);

    if (paymentType) {
      if (paymentType.value) {
        payment = paymentType.value;
      } else {
        payment = paymentType;
      }
    }

    if (
      portalId === "5f2ad881ed5a090017f91715" || // Suddath Relocation
      portalId === "64ece35abfc3deb98e9d180f" || // Mc Instant Quote
      portalId === "6384ea07928af40046d4d22a" ||
      portalId === "6717abfa768fb54a3c6823b9" || // Tim Toton
      portalId === "6453ff09eafb1843de4d5cd1"
    ) {
      payment = PaymentType.Cod;
    }

    if (!moveType) {
      moveType = "other";
    }

    if (!pickupLocationType) {
      pickupLocationType = "Residence";
    }

    // Validate required fields
    if (!pickupStartDate) {
      logger.error("Order creation failed: No pickup date provided");
      return next({ statusCode: 400, message: "No pick up date selected." });
    }

    if (!portalId) {
      logger.error("Order creation failed: No portal ID provided");
      return next({ statusCode: 400, message: "Portal ID is required." });
    }

    if (!quoteId) {
      logger.error("Order creation failed: No quote ID provided");
      return next({ statusCode: 400, message: "Quote ID is required." });
    }

    // Database lookups with error handling
    let portal, quote;
    try {
      portal = await Portal.findById(portalId);
      quote = await Quote.findById(quoteId);
    } catch (dbError) {
      logger.error("Database lookup failed during order creation:", dbError);
      return next({
        statusCode: 500,
        message: "Database error occurred while fetching order data.",
      });
    }

    if (!quote) {
      logger.error(`Order creation failed: Quote not found for ID ${quoteId}`);
      return next({
        statusCode: 404,
        message: "Quote not found. Please ensure the quote exists.",
      });
    }

    if (!portal) {
      logger.error(
        `Order creation failed: Portal not found for ID ${portalId}`,
      );
      return next({
        statusCode: 404,
        message: "Portal not found. Please ensure the portal exists.",
      });
    }

    const quoteData = quote as any;
    const portalData = portal as any;

    // Update quote status with error handling
    try {
      quote.status = Status.Booked;
      await quote.save();
    } catch (saveError) {
      logger.error("Failed to update quote status:", saveError);
      return next({
        statusCode: 500,
        message: "Failed to update quote status.",
      });
    }

    let isCustomerPortal =
      quoteData.isCustomerPortal ||
      req.body?.isCustomerPortal === true ||
      req.body?.isCustomerPortal === "true" ||
      req.body?.isCustomerPortal === 1;
    const originalQuotes = Array.isArray(quoteData.vehicles)
      ? quoteData.vehicles
      : [];
    let transitTime = quoteData.transitTime;
    const orderNumber =
      quoteData.refId ?? quoteData.refIdNum ?? quoteData._id?.toString();
    const orderNumberText =
      orderNumber !== undefined && orderNumber !== null
        ? String(orderNumber)
        : undefined;
    const orderNumberNum = orderNumberText
      ? parseInt(orderNumberText)
      : undefined;
    let companyName = portalData.companyName;
    const logo = portalData.logo ? portalData.logo : "";
    const normalizedTransportType = String(
      transportType || quoteData.transportType || "",
    ).toLowerCase();
    transportType =
      normalizedTransportType === TransportType.Enclosed
        ? TransportType.Enclosed
        : normalizedTransportType === TransportType.WhiteGlove
          ? TransportType.WhiteGlove
          : TransportType.Open;

    if (transportType === TransportType.WhiteGlove) {
      payment = PaymentType.Cod;
    }

    payment = String(payment || "").toLowerCase();

    // Check if delivery address has changed from original quote
    const originalDeliveryAddress =
      quoteData.destination?.validated ||
      quoteData.destination?.userInput ||
      quoteData.delivery ||
      "";

    // Extract city and state from original address for comparison
    let originalCity, originalState;
    if (originalDeliveryAddress) {
      const parts = originalDeliveryAddress
        .split(",")
        .map((part: string) => part.trim());
      if (parts.length >= 2) {
        originalCity = parts[0];
        originalState = parts[1];
      }
    }

    const normalizeLocationValue = (value: any) => {
      if (!value) return "";
      if (typeof value === "string") return value;
      if (typeof value === "object") {
        return value.value || value.label || value.state || value.city || "";
      }
      return String(value);
    };

    const normalizedDeliveryCity = normalizeLocationValue(deliveryCity);
    const normalizedDeliveryState = normalizeLocationValue(deliveryState);

    // Compare city and state instead of full address
    const addressChanged =
      originalCity &&
      originalState &&
      (originalCity.toLowerCase() !== normalizedDeliveryCity.toLowerCase() ||
        originalState.toLowerCase() !== normalizedDeliveryState.toLowerCase());

    if (addressChanged) {
      logger.info(
        `Delivery address changed from "${originalCity}, ${originalState}" to "${normalizedDeliveryCity}, ${normalizedDeliveryState}". Recalculating transit time.`,
      );
      // Note: Transit time recalculation would need to be implemented here
      // For now, we'll use the original transit time but log the change
    }

    let openTransport = transportType === TransportType.Open;

    // Check for existing order
    let existingOrder;
    try {
      existingOrder = await Order.find({ quote: quote._id });
    } catch (dbError) {
      logger.error("Failed to check for existing order:", dbError);
      return next({
        statusCode: 500,
        message: "Database error occurred while checking for existing orders.",
      });
    }

    if (existingOrder[0]) {
      logger.warn(
        `Order creation failed: Order already exists for quote ${quote._id}`,
      );
      return next({
        statusCode: 409,
        message: "Order already exists for this quote.",
      });
    }

    // Settings lookup with error handling
    let settings: any;
    let holidayDates: Date[] = [];
    try {
      settings = await Settings.findOne({});
      if (!settings) {
        logger.warn("No settings found, using empty holiday dates");
        holidayDates = [];
      } else {
        holidayDates = settings.holidays
          ? settings.holidays
              .map((holiday: any) => {
                const rawDate = holiday?.date ?? holiday;
                const parsedDate =
                  rawDate instanceof Date ? rawDate : new Date(rawDate);
                return parsedDate;
              })
              .filter((date: Date) => !isNaN(date.getTime()))
          : [];
      }
    } catch (settingsError) {
      logger.error("Failed to fetch settings:", settingsError);
      holidayDates = []; // Use empty array as fallback
    }

    const normalizeTransitTime = (value: any) => {
      if (!Array.isArray(value) || value.length < 2) {
        return null;
      }
      const minDays = Number(value[0]);
      const maxDays = Number(value[1]);
      if (!Number.isFinite(minDays) || !Number.isFinite(maxDays)) {
        return null;
      }
      return [minDays, maxDays] as [number, number];
    };

    const milesValue = Number(quoteData.miles);
    const normalizedTransitTime = normalizeTransitTime(transitTime);
    if (!normalizedTransitTime) {
      const transitTimes = Array.isArray(settings?.transitTimes)
        ? settings.transitTimes
        : [];
      const matchedRange = transitTimes.find(
        (range: any) =>
          Number.isFinite(milesValue) &&
          Number.isFinite(range?.minMiles) &&
          Number.isFinite(range?.maxMiles) &&
          milesValue >= Number(range.minMiles) &&
          milesValue <= Number(range.maxMiles),
      );
      if (matchedRange) {
        transitTime = [
          Number(matchedRange.minDays),
          Number(matchedRange.maxDays),
        ];
      } else if (transitTimes.length > 0) {
        transitTime = [
          Number(transitTimes[0].minDays),
          Number(transitTimes[0].maxDays),
        ];
      }
    } else {
      transitTime = normalizedTransitTime;
    }

    const parseAddressParts = (addressText: string) => {
      if (!addressText) {
        return {};
      }
      const parts = addressText.split(",").map((part) => part.trim());
      let city = "";
      let state = "";
      let zip = "";
      let address = "";

      if (parts.length === 1) {
        address = parts[0];
      } else if (parts.length >= 2) {
        address = parts.slice(0, parts.length - 1).join(", ");
        const lastPart = parts[parts.length - 1];
        const stateZipMatch = lastPart.match(/([A-Z]{2})\s*(\d{5})?/i);
        if (stateZipMatch) {
          state = stateZipMatch[1]?.toUpperCase() || "";
          zip = stateZipMatch[2] || "";
        }
        if (parts.length >= 2) {
          city = parts[parts.length - 2];
        }
      }

      return { address, city, state, zip };
    };

    if (!pickupAddress || !pickupCity || !pickupState || !pickupZip) {
      const pickupFallback =
        quoteData.origin?.validated ||
        quoteData.origin?.userInput ||
        quoteData.pickup ||
        "";
      const parsedPickup = parseAddressParts(pickupFallback);
      pickupAddress = pickupAddress || parsedPickup.address || pickupFallback;
      pickupCity = pickupCity || parsedPickup.city;
      pickupState = pickupState || parsedPickup.state;
      pickupZip = pickupZip || parsedPickup.zip;
    }

    if (!deliveryAddress || !deliveryCity || !deliveryState || !deliveryZip) {
      const deliveryFallback =
        quoteData.destination?.validated ||
        quoteData.destination?.userInput ||
        quoteData.delivery ||
        "";
      const parsedDelivery = parseAddressParts(deliveryFallback);
      deliveryAddress =
        deliveryAddress || parsedDelivery.address || deliveryFallback;
      deliveryCity = deliveryCity || parsedDelivery.city;
      deliveryState = deliveryState || parsedDelivery.state;
      deliveryZip = deliveryZip || parsedDelivery.zip;
    }

    if (pickupState && pickupState.value) {
      pickupState = pickupState.value;
    }

    if (deliveryState && deliveryState.value) {
      deliveryState = deliveryState.value;
    }

    // Geocoding with improved error handling
    let pickupCoords, deliveryCoords;
    try {
      const pickupAddressString = `${pickupAddress} ${pickupCity} ${pickupState} ${pickupZip}`;
      const deliveryAddressString = `${deliveryAddress} ${deliveryCity} ${deliveryState} ${deliveryZip}`;

      logger.info(`Geocoding pickup address: ${pickupAddressString}`);
      pickupCoords = await geocode(pickupAddressString);

      logger.info(`Geocoding delivery address: ${deliveryAddressString}`);
      deliveryCoords = await geocode(deliveryAddressString);
    } catch (geocodeError) {
      logger.error("Geocoding failed:", geocodeError);
      return next({
        statusCode: 500,
        message:
          "Failed to geocode addresses. Please check the addresses and try again.",
      });
    }

    if (!pickupCoords || !deliveryCoords) {
      logger.error(
        `Geocoding failed - Pickup coords: ${!!pickupCoords}, Delivery coords: ${!!deliveryCoords}`,
      );
      return next({
        statusCode: 500,
        message:
          "Could not find coordinates for the provided addresses. Please verify the addresses are correct.",
      });
    }

    // Validate coordinates
    if (
      !pickupCoords.latitude ||
      !pickupCoords.longitude ||
      !deliveryCoords.latitude ||
      !deliveryCoords.longitude
    ) {
      logger.error("Invalid coordinates received from geocoding service");
      return next({
        statusCode: 500,
        message: "Invalid coordinates received. Please check the addresses.",
      });
    }

    const normalizedCustomerName =
      customerFullName || customer?.name || quote.customer?.name || "";
    const normalizedCustomerEmail =
      customerEmail || customer?.email || quote.customer?.email || "";
    const normalizedCustomerPhone =
      customerPrimaryPhone || customer?.phone || quote.customer?.phone || "";
    let formattedCustomerPrimaryPhone = formatPhoneNumber(
      normalizedCustomerPhone,
    );
    let formattedCustomerAltPhone = formatPhoneNumber(customerAltPhone);
    let formattedPickupPrimaryPhone = formatPhoneNumber(pickupPrimaryPhone);
    let formattedPickupAltPhone = formatPhoneNumber(pickupAltPhone);
    let formattedDeliveryPrimaryPhone = formatPhoneNumber(deliveryPrimaryPhone);
    let formattedDeliveryAltPhone = formatPhoneNumber(deliveryAltPhone);

    let customerMobile,
      pickupMobile,
      deliveryMobile,
      customerPhone,
      pickupPhone,
      deliveryPhone;

    if (customerPrimaryPhoneIsMobile) {
      // Alt phone IS NOT mobile
      if (!customerAltPhoneIsMobile) {
        customerMobile = formattedCustomerPrimaryPhone;
        customerPhone = formattedCustomerAltPhone;
        // Alt phone IS ALSO mobile
      } else {
        customerMobile = formattedCustomerAltPhone;
        customerPhone = formattedCustomerPrimaryPhone;
      }
    } else if (!customerPrimaryPhoneIsMobile) {
      customerPhone = formattedCustomerPrimaryPhone;

      if (customerAltPhoneIsMobile) {
        customerMobile = formattedCustomerAltPhone;
      } else {
        customerAltPhone = formattedCustomerAltPhone;
      }
    }

    if (pickupPrimaryPhoneIsMobile) {
      if (!pickupAltPhoneIsMobile) {
        pickupMobile = formattedPickupPrimaryPhone;
        pickupPhone = formattedPickupAltPhone;
      } else {
        customerMobile = formattedPickupAltPhone;
        pickupPhone = formattedPickupPrimaryPhone;
      }
    } else {
      pickupPhone = formattedPickupPrimaryPhone;
      if (pickupAltPhoneIsMobile) {
        pickupMobile = formattedPickupAltPhone;
      } else {
        pickupAltPhone = formattedPickupAltPhone;
      }
    }

    if (deliveryPrimaryPhoneIsMobile) {
      if (!deliveryAltPhoneIsMobile) {
        deliveryMobile = formattedDeliveryPrimaryPhone;
        deliveryPhone = formattedDeliveryAltPhone;
      } else {
        customerMobile = formattedDeliveryAltPhone;
        deliveryPhone = formattedDeliveryPrimaryPhone;
      }
    } else {
      deliveryPhone = formattedDeliveryPrimaryPhone;
      if (deliveryAltPhoneIsMobile) {
        deliveryMobile = formattedDeliveryAltPhone;
      } else {
        deliveryAltPhone = formattedDeliveryAltPhone;
      }
    }

    const normalizedServiceLevel = Number(serviceLevel?.value ?? serviceLevel);
    const effectiveServiceLevel = Number.isNaN(normalizedServiceLevel)
      ? 1
      : normalizedServiceLevel;
    const scheduleServiceLevel =
      transportType === TransportType.WhiteGlove
        ? ServiceLevelOption.WhiteGlove
        : String(effectiveServiceLevel);

    // Date range calculation with error handling
    let dateRanges;
    try {
      dateRanges = getDateRanges(
        pickupStartDate,
        effectiveServiceLevel,
        transitTime,
        holidayDates,
      );

      if (!dateRanges || !Array.isArray(dateRanges) || dateRanges.length < 4) {
        logger.error(
          "Invalid date ranges returned from getDateRanges:",
          dateRanges,
        );
        return next({
          statusCode: 500,
          message:
            "Failed to calculate delivery dates. Please check the pickup date and service level.",
        });
      }

      logger.info(
        `Date ranges calculated: ${dateRanges
          .map((d) => new Date(d).toISOString())
          .join(", ")}`,
      );
    } catch (dateError) {
      logger.error("Date range calculation failed:", dateError);
      return next({
        statusCode: 500,
        message:
          "Failed to calculate delivery dates. Please check the pickup date and service level.",
      });
    }

    let superResponse;

    // Merge request body vehicle data with original quote data
    const requestQuotes = Array.isArray(req.body.quotes) ? req.body.quotes : [];
    const normalizeVehicle = (vehicle: any) =>
      typeof vehicle?.toObject === "function" ? vehicle.toObject() : vehicle;
    quotes =
      requestQuotes.length > 0
        ? originalQuotes.map((originalVehicle: any, index: number) => {
            const originalVehicleData = normalizeVehicle(originalVehicle) || {};
            const requestVehicle = requestQuotes[index] || {};
            const requestVehicleData = normalizeVehicle(requestVehicle) || {};
            return {
              ...originalVehicleData,
              ...requestVehicleData, // VIN/year override only
              pricing:
                originalVehicleData.pricing ?? requestVehicleData.pricing,
            };
          })
        : originalQuotes.map((vehicle: any) => normalizeVehicle(vehicle));

    if (quotes.length === 0) {
      return next({
        statusCode: 400,
        message: "No vehicles found in original quote.",
      });
    }

    // SuperDispatch integration with improved error handling
    // Send partial order initially (withheld addresses) - full details will be sent when carrier accepts
    const hasRequiredPartialOrderFields = Boolean(
      orderNumberText &&
        pickupCity &&
        pickupState &&
        pickupZip &&
        deliveryCity &&
        deliveryState &&
        deliveryZip,
    );
    if (
      !isCustomerPortal &&
      payment !== PaymentType.Cod &&
      transportType !== TransportType.WhiteGlove &&
      hasRequiredPartialOrderFields
    ) {
      try {
        logger.info(
          `Sending partial order ${orderNumberText} to SuperDispatch (addresses withheld)`,
        );
        superResponse = await sendPartialOrderToSuper({
          quotes,
          orderNumber: orderNumberText,
          reg,
          portal,
          dateRanges,
          transportType,
          pickupCity,
          pickupState,
          pickupZip,
          deliveryCity,
          deliveryState,
          deliveryZip,
          serviceLevel,
        });

        if (!superResponse) {
          logger.error("SuperDispatch returned null response");
          return next({
            statusCode: 500,
            message:
              "Failed to create order in SuperDispatch. Please try again.",
          });
        }

        if (superResponse && superResponse.error) {
          logger.error("SuperDispatch returned error:", superResponse.error);
          return next({
            statusCode: 500,
            message: `SuperDispatch error: ${superResponse.error}`,
          });
        }

        logger.info(
          `Successfully sent partial order ${orderNumberText} to SuperDispatch. Full details will be revealed when carrier accepts.`,
        );
      } catch (superError) {
        logger.error("SuperDispatch API call failed:", superError);
        return next({
          statusCode: 500,
          message:
            "Failed to communicate with SuperDispatch. Please try again later.",
        });
      }
    } else if (
      !isCustomerPortal &&
      payment !== PaymentType.Cod &&
      transportType !== TransportType.WhiteGlove
    ) {
      logger.warn(
        "Skipping SuperDispatch partial order: missing required data",
        {
          orderNumber: orderNumberText,
          pickupCity,
          pickupState,
          pickupZip,
          deliveryCity,
          deliveryState,
          deliveryZip,
        },
      );
    }

    // Vehicle data processing with error handling
    let dbVehicleData;
    try {
      dbVehicleData = quotes.map((quote: any, index: number) => {
        try {
          const pricingTotals =
            transportType === TransportType.WhiteGlove
              ? null
              : (quote?.pricing?.totals ?? null);
          const totalsKey =
            effectiveServiceLevel === 1
              ? "one"
              : effectiveServiceLevel === 3
                ? "three"
                : effectiveServiceLevel === 5
                  ? "five"
                  : "seven";
          const totalsForLevel = pricingTotals?.[totalsKey];
          const totalWhiteGlove =
            pricingTotals?.whiteGlove ??
            quoteData?.totalPricing?.totals?.whiteGlove ??
            null;
          const perVehicleWhiteGlove =
            totalWhiteGlove != null && quotes.length > 0
              ? totalWhiteGlove / quotes.length
              : totalWhiteGlove;
          const totalOpen =
            totalsForLevel?.open?.totalWithCompanyTariffAndCommission ??
            totalsForLevel?.open?.total ??
            totalsForLevel?.totalWithCompanyTariffAndCommission ??
            totalsForLevel?.total;
          const totalEnclosed =
            totalsForLevel?.enclosed?.totalWithCompanyTariffAndCommission ??
            totalsForLevel?.enclosed?.total ??
            totalsForLevel?.totalWithCompanyTariffAndCommission ??
            totalsForLevel?.total;

          const hasWhiteGlove =
            transportType === TransportType.WhiteGlove &&
            perVehicleWhiteGlove != null;
          if (totalOpen == null && totalEnclosed == null && !hasWhiteGlove) {
            logger.error(
              `Vehicle ${index}: No pricing totals found for service level ${effectiveServiceLevel}`,
            );
            throw new Error(
              `No pricing found for service level ${effectiveServiceLevel} for vehicle ${index}`,
            );
          }

          let calculatedQuote: any = {
            openTransportPortal: hasWhiteGlove
              ? perVehicleWhiteGlove
              : (totalOpen ?? 0),
            enclosedTransportPortal: hasWhiteGlove
              ? perVehicleWhiteGlove
              : (totalEnclosed ?? 0),
            openTransportSD: hasWhiteGlove
              ? perVehicleWhiteGlove
              : (totalOpen ?? 0),
            enclosedTransportSD: hasWhiteGlove
              ? perVehicleWhiteGlove
              : (totalEnclosed ?? 0),
            companyTariffOpen:
              totalsForLevel?.open?.companyTariff ??
              totalsForLevel?.companyTariff ??
              0,
            companyTariffEnclosed:
              totalsForLevel?.enclosed?.companyTariff ??
              totalsForLevel?.companyTariff ??
              0,
          };

          // Set companyTariff based on transport type
          if (
            transportType === TransportType.Open &&
            calculatedQuote.companyTariffOpen > 0
          ) {
            calculatedQuote.companyTariff = calculatedQuote.companyTariffOpen;
          } else if (
            transportType === TransportType.Enclosed &&
            calculatedQuote.companyTariffEnclosed > 0
          ) {
            calculatedQuote.companyTariff =
              calculatedQuote.companyTariffEnclosed;
          }

          // Update for dual-transport quoting
          let vehicleTariff;

          if (transportType === TransportType.Open) {
            vehicleTariff = calculatedQuote.openTransportPortal;
          } else {
            vehicleTariff = calculatedQuote.enclosedTransportPortal;
          }

          if (transportType === TransportType.Enclosed) {
            calculatedQuote.totalSD = calculatedQuote.enclosedTransportSD;
            calculatedQuote.totalPortal =
              calculatedQuote.enclosedTransportPortal;
            calculatedQuote.enclosedMarkup = settings?.enclosedMarkup || 0;
          }

          let opBool =
            quote.operableBool === true ||
            quote.operableBool === "Yes" ||
            quote.operableBool === "true"
              ? true
              : false;

          if (!opBool) {
            if (
              quote.operable &&
              ["Yes", true, "true"].includes(quote.operable)
            ) {
              opBool = true;
            } else {
              opBool = false;
            }
          }

          const sourcePricing = quote?.pricing ?? {};
          const sourceModifiers = sourcePricing?.modifiers ?? {};
          const normalizedModifiers =
            transportType === TransportType.WhiteGlove
              ? {
                  inoperable: sourceModifiers.inoperable ?? 0,
                  routes: sourceModifiers.routes ?? 0,
                  states: sourceModifiers.states ?? 0,
                  oversize: sourceModifiers.oversize ?? 0,
                  vehicles: sourceModifiers.vehicles ?? 0,
                  globalDiscount: sourceModifiers.globalDiscount ?? 0,
                  portalDiscount: sourceModifiers.portalDiscount ?? 0,
                  irr: sourceModifiers.irr ?? 0,
                  fuel: sourceModifiers.fuel ?? 0,
                  enclosedFlat: sourceModifiers.enclosedFlat ?? 0,
                  enclosedPercent: sourceModifiers.enclosedPercent ?? 0,
                  commission: sourceModifiers.commission ?? 0,
                  serviceLevel: 0,
                  companyTariff: 0,
                }
              : sourceModifiers;

          return {
            ...quote,
            operableBool: opBool,
            operable: opBool,
            tariff: vehicleTariff,
            type: quote.pricingClass?.toLowerCase() || "other",
            pricingClass: quote.pricingClass?.toLowerCase() || "other",
            pricing: {
              base: sourcePricing.base ?? 0,
              modifiers: normalizedModifiers,
              total: vehicleTariff ?? 0,
              totalWithCompanyTariffAndCommission:
                calculatedQuote.companyTariff != null
                  ? (vehicleTariff ?? 0) + (calculatedQuote.companyTariff || 0)
                  : (vehicleTariff ?? 0),
              ...(transportType === TransportType.WhiteGlove
                ? {}
                : { totals: pricingTotals ?? sourcePricing.totals ?? null }),
            },
          };
        } catch (vehicleError) {
          logger.error(`Error processing vehicle ${index}:`, vehicleError);
          throw vehicleError;
        }
      });
    } catch (vehicleProcessingError) {
      const errorMessage =
        vehicleProcessingError instanceof Error
          ? vehicleProcessingError.message
          : String(vehicleProcessingError);
      logger.error("Vehicle data processing failed:", vehicleProcessingError);
      return next({
        statusCode: 500,
        message: `Failed to process vehicle data: ${errorMessage}`,
      });
    }

    let userName: string = "";
    let orderUserId: string | null = "";

    if (isCustomerPortal) {
      userName = "Customer Order";
      orderUserId = null;
    } else {
      userName = quoteData.userName;
      orderUserId = quoteData.userId;
    }

    const portalIdForAgents =
      String(portalId || "") || String((portalData as any)?._id || "") || "";
    if (
      MMI_PORTALS.includes(portalIdForAgents as (typeof MMI_PORTALS)[number])
    ) {
      agents = [
        {
          email: "autodeskupdates@graebel.com",
          name: "Auto Desk",
          pickup: true,
          delivery: true,
        },
      ];
    }

    // User lookup for agents with error handling
    if (
      (!agents ||
        agents.length === 0 ||
        (agents[0] && !agents[0].name)) &&
      orderUserId &&
      !MMI_PORTALS.includes(portalIdForAgents as (typeof MMI_PORTALS)[number])
    ) {
      try {
        let foundUser = await User.findById(orderUserId);

        if (!foundUser) {
          logger.warn(
            `User not found for ID ${orderUserId}, using default agent info`,
          );
          agents = [
            {
              email: "support@mccollisters.com",
              name: userName || "Unknown User",
              pickup: true,
              delivery: true,
            },
          ];
        } else {
          const resolvedUserName =
            (foundUser as any).fullName ||
            [foundUser.firstName, foundUser.lastName]
              .filter(Boolean)
              .join(" ")
              .trim() ||
            userName ||
            "Unknown User";
          agents = [
            {
              email: foundUser.email,
              name: resolvedUserName,
              pickup: true,
              delivery: true,
            },
          ];
        }
      } catch (userError) {
        logger.error("Failed to lookup user for agents:", userError);
        agents = [
          {
            email: "support@mccollisters.com",
            name: userName || "Unknown User",
            pickup: true,
            delivery: true,
          },
        ];
      }
    }

    const totalKey =
      effectiveServiceLevel === 1
        ? "one"
        : effectiveServiceLevel === 3
          ? "three"
          : effectiveServiceLevel === 5
            ? "five"
            : "seven";
    let pricing: any = quoteData.totalPricing?.totals?.[totalKey];
    const pricingTotalsForLevel = pricing;
    const selectedTotal =
      transportType === TransportType.WhiteGlove
        ? (quoteData.totalPricing?.totals?.whiteGlove ?? 0)
        : transportType === TransportType.Enclosed
          ? (pricingTotalsForLevel?.enclosed?.total ??
            pricingTotalsForLevel?.total ??
            0)
          : (pricingTotalsForLevel?.open?.total ??
            pricingTotalsForLevel?.total ??
            0);
    const selectedTotalWithCompanyTariffAndCommission =
      transportType === TransportType.WhiteGlove
        ? (quoteData.totalPricing?.totals?.whiteGlove ?? 0)
        : transportType === TransportType.Enclosed
          ? (pricingTotalsForLevel?.enclosed
              ?.totalWithCompanyTariffAndCommission ?? selectedTotal)
          : (pricingTotalsForLevel?.open?.totalWithCompanyTariffAndCommission ??
            selectedTotal);
    const modifierServiceLevel =
      transportType === TransportType.WhiteGlove
        ? 0
        : (quoteData.totalPricing?.modifiers?.serviceLevels?.find(
            (item: any) =>
              String(item.serviceLevelOption) === String(effectiveServiceLevel),
          )?.value ?? 0);
    const modifierCompanyTariff =
      transportType === TransportType.WhiteGlove
        ? 0
        : (quoteData.totalPricing?.modifiers?.companyTariffs?.find(
            (item: any) =>
              String(item.serviceLevelOption) === String(effectiveServiceLevel),
          )?.value ?? 0);
    const totalPricingSummary = {
      base: quoteData.totalPricing?.base ?? 0,
      modifiers: {
        inoperable: quoteData.totalPricing?.modifiers?.inoperable ?? 0,
        routes: quoteData.totalPricing?.modifiers?.routes ?? 0,
        states: quoteData.totalPricing?.modifiers?.states ?? 0,
        oversize: quoteData.totalPricing?.modifiers?.oversize ?? 0,
        vehicles: quoteData.totalPricing?.modifiers?.vehicles ?? 0,
        globalDiscount: quoteData.totalPricing?.modifiers?.globalDiscount ?? 0,
        portalDiscount: quoteData.totalPricing?.modifiers?.portalDiscount ?? 0,
        irr: quoteData.totalPricing?.modifiers?.irr ?? 0,
        fuel: quoteData.totalPricing?.modifiers?.fuel ?? 0,
        enclosedFlat: quoteData.totalPricing?.modifiers?.enclosedFlat ?? 0,
        enclosedPercent:
          quoteData.totalPricing?.modifiers?.enclosedPercent ?? 0,
        commission: quoteData.totalPricing?.modifiers?.commission ?? 0,
        serviceLevel: modifierServiceLevel,
        companyTariff: modifierCompanyTariff,
      },
      total: selectedTotal,
      totalWithCompanyTariffAndCommission:
        selectedTotalWithCompanyTariffAndCommission ?? selectedTotal,
    };

    if (transportType === TransportType.Enclosed) {
      pricing.totalSD = pricing?.enclosed?.totalWithCompanyTariffAndCommission;
      pricing.totalPortal = pricing?.enclosed?.total;
    }

    const orderRefId = quoteData.refId ?? orderNumberNum;

    // Create original order data backup before SuperDispatch updates
    const originalOrderData = {
      refId: orderRefId,
      reg,
      status: Status.Booked,
      portalId: String(portalData._id),
      userId: orderUserId ? String(orderUserId) : null,
      quoteId: String(quoteData._id),
      miles: quoteData.miles,
      transportType,
      customer: {
        name: normalizedCustomerName,
        firstName: customerFirstName,
        lastName: customerLastName,
        phone: customerPhone,
        phoneMobile: customerMobile,
        email: normalizedCustomerEmail,
      },
      origin: {
        contact: {
          name: pickupContactName,
          phone: pickupPhone,
          phoneMobile: pickupMobile,
        },
        address: {
          address: pickupAddress,
          city: pickupCity,
          state: pickupState,
          zip: pickupZip,
        },
        notes: pickupNotes,
        longitude: pickupCoords.longitude,
        latitude: pickupCoords.latitude,
      },
      destination: {
        contact: {
          name: deliveryContactName,
          phone: deliveryPhone,
          phoneMobile: deliveryMobile,
        },
        address: {
          address: deliveryAddress,
          city: deliveryCity,
          state: deliveryState,
          zip: deliveryZip,
        },
        notes: deliveryNotes,
        longitude: deliveryCoords.longitude,
        latitude: deliveryCoords.latitude,
      },
      vehicles: dbVehicleData,
      totalPricing: totalPricingSummary,
      paymentType: payment,
      schedule: {
        serviceLevel: scheduleServiceLevel,
        pickupSelected: new Date(dateRanges[0]),
        pickupEstimated: [new Date(dateRanges[0]), new Date(dateRanges[1])],
        deliveryEstimated: [new Date(dateRanges[2]), new Date(dateRanges[3])],
      },
      agents,
    };

    let orderDetailsForDb = {
      orderTableCustomer: normalizedCustomerName
        ? normalizedCustomerName.trim()
        : null,
      orderTableStatus: payment === PaymentType.Cod ? "Pending" : "New",
      orderTablePickupEst: new Date(dateRanges[0]),
      orderTableDeliveryEst: new Date(dateRanges[2]),
      userId: orderUserId,
      userName: userName,
      agentId: orderUserId,
      sirvaNonDomestic,
      portalId: portalData._id,
      portal: portalData._id,
      isCustomerPortal,
      quoteId: quoteData._id,
      quote: quoteData,
      refId: orderRefId,
      serviceLevel: scheduleServiceLevel,
      reg,
      status: Status.Booked,
      miles: quoteData.miles,
      transportType,
      openTransport,
      transitTime,
      companyName,
      logo,
      moveType,
      customer: {
        name: normalizedCustomerName,
        email: normalizedCustomerEmail,
        phone: customerPhone,
        phoneMobile: customerMobile,
      },
      agents,
      pickupLocationType,
      deliveryLocationType,
      origin: {
        contact: {
          name: pickupContactName,
          phone: pickupPhone,
          phoneMobile: pickupMobile,
          email: pickupEmail,
        },
        address: {
          address: pickupAddress,
          city: pickupCity,
          state: pickupState,
          zip: pickupZip,
        },
        notes: pickupNotes,
        longitude: pickupCoords.longitude,
        latitude: pickupCoords.latitude,
      },
      pickup: {
        pickupBusinessName,
        pickupContactName,
        pickupPhone,
        pickupAltPhone: pickupAltPhone ? pickupAltPhone : null,
        pickupMobilePhone: pickupMobile,
        pickupAddress,
        pickupCity,
        pickupState,
        pickupZip,
        pickupNotes,
        pickupLongitude: pickupCoords.longitude,
        pickupLatitude: pickupCoords.latitude,
        pickupScheduledAt: new Date(dateRanges[0]),
        pickupScheduledEndsAt: new Date(dateRanges[1]), // auto
        pickupDateType: "Estimated",
      },
      destination: {
        contact: {
          name: deliveryContactName,
          phone: deliveryPhone,
          phoneMobile: deliveryMobile,
          email: deliveryEmail,
        },
        address: {
          address: deliveryAddress,
          city: deliveryCity,
          state: deliveryState,
          zip: deliveryZip,
        },
        notes: deliveryNotes,
        longitude: deliveryCoords.longitude,
        latitude: deliveryCoords.latitude,
      },
      delivery: {
        deliveryBusinessName,
        deliveryContactName,
        deliveryPhone,
        deliveryMobilePhone: deliveryMobile,
        deliveryAltPhone: deliveryAltPhone ? deliveryAltPhone : null,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        deliveryZip,
        deliveryNotes,
        deliveryLongitude: deliveryCoords.longitude,
        deliveryLatitude: deliveryCoords.latitude,
        deliveryScheduledAt: new Date(dateRanges[2]),
        deliveryScheduledEndsAt: new Date(dateRanges[3]),
        deliveryDateType: "Estimated",
      },
      vehicles: dbVehicleData,
      totalPricing: totalPricingSummary,
      paymentType: payment,
      schedule: {
        serviceLevel: scheduleServiceLevel,
        pickupSelected: new Date(dateRanges[0]),
        pickupEstimated: [new Date(dateRanges[0]), new Date(dateRanges[1])],
        deliveryEstimated: [new Date(dateRanges[2]), new Date(dateRanges[3])],
      },
      tms: {
        guid: superResponse?.guid || null,
        status: superResponse?.status || null,
        createdAt: superResponse?.created_at
          ? new Date(superResponse.created_at)
          : null,
        updatedAt: superResponse?.changed_at
          ? new Date(superResponse.changed_at)
          : null,
      },
      tmsPartialOrder:
        payment !== PaymentType.Cod &&
        transportType !== TransportType.WhiteGlove &&
        superResponse
          ? true
          : false,
      originalOrderData: JSON.stringify(originalOrderData),
    };

    // Final order creation with error handling
    let newOrder;
    try {
      logger.info(`Creating order in database for quote ${quoteId}`);
      newOrder = await Order.create(orderDetailsForDb);

      if (!newOrder) {
        logger.error("Order creation returned null");
        return next({
          statusCode: 500,
          message: "Failed to create order in database.",
        });
      }

      logger.info(
        `Successfully created order ${(newOrder as any).refId} with ID ${newOrder._id}`,
      );
    } catch (orderCreationError) {
      logger.error("Database order creation failed:", orderCreationError);
      const errorMessage =
        orderCreationError instanceof Error
          ? orderCreationError.message
          : String(orderCreationError);
      return next({
        statusCode: 500,
        message: `Failed to create order in database: ${errorMessage}`,
      });
    }

    if (Array.isArray(agents) && agents.length > 0) {
      try {
        const merged = mergeNotificationEmails(
          portalData.notificationEmails || [],
          agents,
        );
        await Portal.findByIdAndUpdate(portalData._id, {
          notificationEmails: merged,
        });
      } catch (error) {
        logger.error("Failed to update portal notification emails:", error);
      }
    }

    // Send agent notifications for non-customer portal orders
    if (!isCustomerPortal) {
      try {
        await sendOrderAgentEmail({
          orderId: String(newOrder._id),
          userId: orderUserId || undefined,
        });
      } catch (notificationError) {
        logger.error("Failed to send order agent email:", notificationError);
        // Don't fail the order creation for notification errors
      }
    }

    // Send white glove notification with error handling
    if (transportType === TransportType.WhiteGlove) {
      try {
        await sendWhiteGloveNotification({ order: newOrder });
        logger.info(
          `White glove notification sent for order ${(newOrder as any).refId}`,
        );
      } catch (notificationError) {
        logger.error(
          "Failed to send white glove notification:",
          notificationError,
        );
        // Don't fail the order creation for notification errors
      }
    }

    // Send MMI order notification if portal is MMI
    const portalIdString = String(portal._id);
    if (MMI_PORTALS.includes(portalIdString as (typeof MMI_PORTALS)[number])) {
      try {
        await sendMMIOrderNotification({
          order: newOrder,
          recipientEmail: "autodesk@graebel.com",
        });
        logger.info(
          `MMI order notification sent for order ${(newOrder as any).refId}`,
        );
      } catch (notificationError) {
        logger.error(
          "Failed to send MMI order notification:",
          notificationError,
        );
        // Don't fail the order creation for notification errors
      }
    }

    // COD payment instructions are appended to the customer confirmation email.

    // Send customer order confirmation email if customer email exists
    if (newOrder.customer?.email) {
      try {
        await sendOrderCustomerPublicNew(newOrder);
        logger.info(
          `Customer order confirmation email sent for order ${(newOrder as any).refId}`,
        );
      } catch (notificationError) {
        logger.error("Failed to send customer order email:", notificationError);
        // Don't fail the order creation for notification errors
      }
    } else {
      logger.warn(
        `Cannot send customer order email: No customer email for order ${(newOrder as any).refId}`,
      );
    }

    res.status(201).json(newOrder);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error("Unexpected error in createOrder:", {
      error: errorMessage,
      stack: errorStack,
      data: {
        portalId: req.body?.portalId,
        quoteId: req.body?.quoteId,
        pickupStartDate: req.body?.pickupStartDate,
        transportType: req.body?.transportType,
        paymentType: req.body?.paymentType,
      },
    });
    return next({
      statusCode: 500,
      message:
        "An unexpected error occurred while creating the order. Please try again.",
    });
  }
};
