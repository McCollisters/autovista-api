import express from "express";
import { Order, Quote, Portal, User, Settings } from "@/_global/models";
import { Status } from "../../_global/enums";
import { logger } from "@/core/logger";
import { geocode } from "../../_global/utils/geocode";
import { formatPhoneNumber } from "../../_global/utils/formatPhoneNumber";
import { getDateRanges } from "../../_global/utils/getDateRanges";
import { sendPartialOrderToSuper } from "../integrations/sendPartialOrderToSuper";
import { sendWhiteGloveNotification } from "../notifications/sendWhiteGloveNotification";
import { sendMMIOrderNotification } from "../notifications/sendMMIOrderNotification";
import { sendCODPaymentRequest } from "../notifications/sendCODPaymentRequest";
import { sendOrderCustomerPublicNew } from "../notifications/sendOrderCustomerPublicNew";
import { MMI_PORTALS } from "../../_global/constants/portalIds";

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

    let payment = "Billing";

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
      payment = "COD";
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

    let isCustomerPortal = quote.isCustomerPortal;
    let originalQuotes = quote.vehicleQuotes;
    let transitTime = quote.transitTime;
    let uniqueId = quote.uniqueId;
    let uniqueIdNum = parseInt(uniqueId);
    let companyName = portal.companyName;
    let companyLogo = portal.logo ? portal.logo : "";
    transportType = transportType || quote.transportType;

    // Check if delivery address has changed from original quote
    const originalDeliveryAddress = quote.delivery;

    // Extract city and state from original address for comparison
    let originalCity, originalState;
    if (originalDeliveryAddress) {
      const parts = originalDeliveryAddress
        .split(",")
        .map((part) => part.trim());
      if (parts.length >= 2) {
        originalCity = parts[0];
        originalState = parts[1];
      }
    }

    // Compare city and state instead of full address
    const addressChanged =
      originalCity &&
      originalState &&
      (originalCity.toLowerCase() !== deliveryCity.toLowerCase() ||
        originalState.toLowerCase() !== deliveryState.toLowerCase());

    if (addressChanged) {
      logger.info(
        `Delivery address changed from "${originalCity}, ${originalState}" to "${deliveryCity}, ${deliveryState}". Recalculating transit time.`,
      );
      // Note: Transit time recalculation would need to be implemented here
      // For now, we'll use the original transit time but log the change
    }

    let openTransport = false;

    if (transportType === "OPEN") {
      openTransport = true;
    }

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
    let settings, holidayDates;
    try {
      settings = await Settings.findOne({});
      if (!settings) {
        logger.warn("No settings found, using empty holiday dates");
        holidayDates = [];
      } else {
        holidayDates = settings.holidays
          ? settings.holidays.map((holiday) => new Date(holiday.date))
          : [];
      }
    } catch (settingsError) {
      logger.error("Failed to fetch settings:", settingsError);
      holidayDates = []; // Use empty array as fallback
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

    let formattedCustomerPrimaryPhone = formatPhoneNumber(customerPrimaryPhone);
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

    // Date range calculation with error handling
    let dateRanges;
    try {
      dateRanges = getDateRanges(
        pickupStartDate,
        serviceLevel,
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
    quotes = originalQuotes.map((originalVehicle, index) => {
      const requestVehicle = req.body.quotes?.[index] || {};
      return {
        ...originalVehicle,
        ...requestVehicle, // This will include VIN and year from request
        calculatedQuotes: originalVehicle.calculatedQuotes,
      };
    });

    if (quotes.length === 0) {
      return next({
        statusCode: 400,
        message: "No vehicles found in original quote.",
      });
    }

    // SuperDispatch integration with improved error handling
    // Send partial order initially (withheld addresses) - full details will be sent when carrier accepts
    if (payment !== "COD" && transportType !== "WHITEGLOVE") {
      try {
        logger.info(
          `Sending partial order ${uniqueId} to SuperDispatch (addresses withheld)`,
        );
        superResponse = await sendPartialOrderToSuper({
          quotes,
          uniqueId,
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
          `Successfully sent partial order ${uniqueId} to SuperDispatch. Full details will be revealed when carrier accepts.`,
        );
      } catch (superError) {
        logger.error("SuperDispatch API call failed:", superError);
        return next({
          statusCode: 500,
          message:
            "Failed to communicate with SuperDispatch. Please try again later.",
        });
      }
    }

    // Vehicle data processing with error handling
    let dbVehicleData;
    try {
      dbVehicleData = quotes.map((quote, index) => {
        try {
          let calculatedQuotes = quote.calculatedQuotes;

          if (!calculatedQuotes) {
            logger.error(`Vehicle ${index}: No calculated quotes found`);
            throw new Error(`No calculated quotes found for vehicle ${index}`);
          }

          if (
            typeof calculatedQuotes === "string" ||
            calculatedQuotes instanceof String
          ) {
            try {
              calculatedQuotes = JSON.parse(calculatedQuotes);
            } catch (parseError) {
              logger.error(
                `Vehicle ${index}: Failed to parse calculated quotes JSON:`,
                parseError,
              );
              throw new Error(
                `Invalid calculated quotes format for vehicle ${index}`,
              );
            }
          }

          if (!Array.isArray(calculatedQuotes)) {
            logger.error(
              `Vehicle ${index}: Calculated quotes is not an array:`,
              typeof calculatedQuotes,
            );
            throw new Error(
              `Calculated quotes must be an array for vehicle ${index}`,
            );
          }

          let calculatedQuote = calculatedQuotes.find((q) => {
            return parseInt(q.days) === serviceLevel;
          });

          if (!calculatedQuote) {
            logger.error(
              `Vehicle ${index}: No calculated quote found for service level ${serviceLevel}`,
            );
            throw new Error(
              `No pricing found for service level ${serviceLevel} for vehicle ${index}`,
            );
          }

          // Set companyTariff based on transport type
          if (
            transportType === "OPEN" &&
            calculatedQuote.companyTariffOpen > 0
          ) {
            calculatedQuote.companyTariff = calculatedQuote.companyTariffOpen;
          } else if (
            transportType === "ENCLOSED" &&
            calculatedQuote.companyTariffEnclosed > 0
          ) {
            calculatedQuote.companyTariff =
              calculatedQuote.companyTariffEnclosed;
          }

          // Update for dual-transport quoting
          let vehicleTariff;

          if (transportType === "OPEN") {
            vehicleTariff = calculatedQuote.openTransportPortal;
          } else {
            vehicleTariff = calculatedQuote.enclosedTransportPortal;
          }

          if (transportType === "ENCLOSED") {
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

          return {
            ...quote,
            operableBool: opBool,
            operable: opBool,
            tariff: vehicleTariff,
            type: quote.pricingClass?.toLowerCase() || "other",
            pricingClass: quote.pricingClass?.toLowerCase() || "other",
            pricing: calculatedQuote,
          };
        } catch (vehicleError) {
          logger.error(`Error processing vehicle ${index}:`, vehicleError);
          throw vehicleError;
        }
      });
    } catch (vehicleProcessingError) {
      logger.error("Vehicle data processing failed:", vehicleProcessingError);
      return next({
        statusCode: 500,
        message: `Failed to process vehicle data: ${vehicleProcessingError.message}`,
      });
    }

    let userName = "";
    let orderUserId = "";

    if (isCustomerPortal) {
      userName = "Customer Order";
      orderUserId = null;
    } else {
      userName = quote.userName;
      orderUserId = quote.userId;
    }

    if (portalId === "60d364c5176cba0017cbd78f") {
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
      ((agents && agents[0] && !agents[0].name) || !agents) &&
      orderUserId &&
      portalId !== "60d364c5176cba0017cbd78f"
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
          agents = [
            {
              email: foundUser.email,
              name: userName,
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

    let pricing = quote.totalPricing[serviceLevel];

    if (transportType === "ENCLOSED") {
      pricing.totalSD =
        quote.totalPricing[serviceLevel].totalEnclosedTransportSD;
      pricing.totalPortal =
        quote.totalPricing[serviceLevel].totalEnclosedTransportPortal;
    }

    // Create original order data backup before SuperDispatch updates
    const originalOrderData = {
      orderTableCustomer: customerFullName ? customerFullName.trim() : null,
      orderTableStatus: payment === "COD" ? "Pending" : "New",
      orderTablePickupEst: new Date(dateRanges[0]),
      orderTableDeliveryEst: new Date(dateRanges[2]),
      userId: orderUserId,
      userName: userName,
      agentId: orderUserId,
      sirvaNonDomestic,
      portalId: portal._id,
      portal: portal._id,
      isCustomerPortal,
      uniqueId,
      uniqueIdNum,
      quote,
      serviceLevel,
      reg,
      status: payment === "COD" ? "Pending" : "Booked",
      miles: quote.miles,
      transportType,
      openTransport,
      transitTime,
      companyName,
      companyLogo,
      moveType,
      customer: {
        customerFullName,
        customerFirstName,
        customerLastName,
        customerPhone,
        customerMobilePhone: customerMobile,
        customerAltPhone: customerAltPhone ? customerAltPhone : null,
        customerEmail,
      },
      agents,
      pickupLocationType,
      deliveryLocationType,
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
      totalPricing: pricing,
      paymentType: payment,
    };

    // Create original order data backup before SuperDispatch updates
    const originalOrderData = {
      refId: uniqueId,
      reg,
      status: payment === "COD" ? "Pending" : "Booked",
      portalId: portal._id.toString(),
      userId: orderUserId.toString(),
      quoteId: quote._id.toString(),
      miles: quote.miles,
      transportType,
      customer: {
        name: customerFullName,
        firstName: customerFirstName,
        lastName: customerLastName,
        phone: customerPhone,
        phoneMobile: customerMobile,
        email: customerEmail,
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
      totalPricing: pricing,
      paymentType: payment,
      schedule: {
        serviceLevel,
        pickupSelected: new Date(dateRanges[0]),
        pickupEstimated: [new Date(dateRanges[0]), new Date(dateRanges[1])],
        deliveryEstimated: [new Date(dateRanges[2]), new Date(dateRanges[3])],
      },
      agents,
    };

    let orderDetailsForDb = {
      orderTableCustomer: customerFullName ? customerFullName.trim() : null,
      orderTableStatus: payment === "COD" ? "Pending" : "New",
      orderTablePickupEst: new Date(dateRanges[0]),
      orderTableDeliveryEst: new Date(dateRanges[2]),
      userId: orderUserId,
      userName: userName,
      agentId: orderUserId,
      sirvaNonDomestic,
      portalId: portal._id,
      portal: portal._id,
      isCustomerPortal,
      uniqueId,
      uniqueIdNum,
      quote,
      serviceLevel,
      reg,
      status: payment === "COD" ? "Pending" : "Booked",
      miles: quote.miles,
      transportType,
      openTransport,
      transitTime,
      companyName,
      companyLogo,
      moveType,
      customer: {
        customerFullName,
        customerFirstName,
        customerLastName,
        customerPhone,
        customerMobilePhone: customerMobile,
        customerAltPhone: customerAltPhone ? customerAltPhone : null,
        customerEmail,
      },
      agents,
      pickupLocationType,
      deliveryLocationType,
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
      totalPricing: pricing,
      paymentType: payment,
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
        payment !== "COD" && transportType !== "WHITEGLOVE" && superResponse
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
        `Successfully created order ${newOrder.uniqueId} with ID ${newOrder._id}`,
      );
    } catch (orderCreationError) {
      logger.error("Database order creation failed:", orderCreationError);
      return next({
        statusCode: 500,
        message: `Failed to create order in database: ${orderCreationError.message}`,
      });
    }

    // Send white glove notification with error handling
    if (transportType === "WHITEGLOVE") {
      try {
        await sendWhiteGloveNotification({ order: newOrder });
        logger.info(
          `White glove notification sent for order ${newOrder.uniqueId}`,
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
    if (MMI_PORTALS.includes(portalIdString)) {
      try {
        await sendMMIOrderNotification({
          order: newOrder,
          recipientEmail: "autodesk@graebel.com",
        });
        logger.info(
          `MMI order notification sent for order ${newOrder.uniqueId}`,
        );
      } catch (notificationError) {
        logger.error(
          "Failed to send MMI order notification:",
          notificationError,
        );
        // Don't fail the order creation for notification errors
      }
    }

    // Send COD payment request if payment type is COD and customer email exists
    if (payment === "COD") {
      if (newOrder.customer?.email) {
        try {
          await sendCODPaymentRequest(newOrder);
          logger.info(
            `COD payment request sent for order ${newOrder.uniqueId}`,
          );
        } catch (notificationError) {
          logger.error(
            "Failed to send COD payment request:",
            notificationError,
          );
          // Don't fail the order creation for notification errors
        }
      } else {
        logger.warn(
          `Cannot send COD payment request: No customer email for order ${newOrder.uniqueId}`,
        );
      }
    }

    // Send customer order confirmation email if customer email exists
    if (newOrder.customer?.email) {
      try {
        await sendOrderCustomerPublicNew(newOrder);
        logger.info(
          `Customer order confirmation email sent for order ${newOrder.uniqueId}`,
        );
      } catch (notificationError) {
        logger.error("Failed to send customer order email:", notificationError);
        // Don't fail the order creation for notification errors
      }
    } else {
      logger.warn(
        `Cannot send customer order email: No customer email for order ${newOrder.uniqueId}`,
      );
    }

    res.status(201).json(newOrder);
  } catch (error) {
    logger.error("Unexpected error in createOrder:", {
      error: error.message,
      stack: error.stack,
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
