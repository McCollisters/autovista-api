import express from "express";
import { Quote, Portal } from "@/_global/models";
import { Status, TransportType } from "../../_global/enums";
import { getCoordinates } from "../../_global/utils/location";
import { getMiles } from "../services/getMiles";
import { updateVehiclesWithPricing } from "../services/updateVehiclesWithPricing";
import { calculateTotalPricing } from "../services/calculateTotalPricing";
import { validateLocation } from "../services/validateLocation";
import { customAlphabet } from "nanoid";
import { logger } from "@/core/logger";

const nanoid = customAlphabet("1234567890abcdef", 10);

/**
 * POST /api/v1/quote/customer
 * Create quote from customer (public endpoint)
 * 
 * Creates a quote with a customer-facing tracking code
 */
export const createQuoteCustomer = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    // Generate unique customer-facing code
    const userFriendlyId = nanoid().toUpperCase();

    // Extract quote details from request
    let {
      customerFirstName,
      customerLastName,
      customerEmail,
      pickup,
      delivery,
      vehicles,
      portalId,
      instance,
      transportType,
    } = req.body;

    // Validation
    if (!pickup) {
      return next({
        statusCode: 400,
        message: "Please enter a valid pickup location.",
      });
    }

    if (!delivery) {
      return next({
        statusCode: 400,
        message: "Please enter a valid delivery location.",
      });
    }

    if (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) {
      return next({
        statusCode: 400,
        message: "Please enter valid vehicles.",
      });
    }

    // Validate pickup/delivery are 5-digit zip codes if numeric
    const pickupNumOnly = /^\d+$/.test(pickup);
    if (pickupNumOnly && pickup.toString().length !== 5) {
      return next({
        statusCode: 400,
        message: "Please enter a valid pickup location.",
      });
    }

    const deliveryNumOnly = /^\d+$/.test(delivery);
    if (deliveryNumOnly && delivery.toString().length !== 5) {
      return next({
        statusCode: 400,
        message: "Please enter a valid delivery location.",
      });
    }

    // Clean up vehicles - normalize operable field
    vehicles = vehicles.map((v: any) => ({
      ...v,
      isInoperable:
        v.operable === "No" ||
        v.operable === false ||
        v.operable === "false" ||
        v.operable?.value === "No"
          ? true
          : false,
    }));

    // Clean up transport type
    transportType = transportType?.value || transportType;

    // Format customer name
    const formatName = (name: string) => {
      if (!name) return "";
      return name
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    };

    const formattedFirstName = customerFirstName
      ? formatName(customerFirstName)
      : "";
    const formattedLastName = customerLastName
      ? formatName(customerLastName)
      : "";
    const customerFullName =
      formattedFirstName && formattedLastName
        ? `${formattedFirstName} ${formattedLastName}`
        : null;

    // Validate locations
    const originValidated = await validateLocation(pickup);
    if (originValidated.error) {
      return next({
        statusCode: 500,
        message: originValidated.error,
      });
    }

    const destinationValidated = await validateLocation(delivery);
    if (destinationValidated.error) {
      return next({
        statusCode: 500,
        message: destinationValidated.error,
      });
    }

    const originState = originValidated.state || "";
    const originLocation = originValidated.location || pickup;
    const destinationState = destinationValidated.state || "";
    const destinationLocation = destinationValidated.location || delivery;

    // Get coordinates
    const originCoords = await getCoordinates(originLocation);
    const destinationCoords = await getCoordinates(destinationLocation);

    if (!originCoords || !destinationCoords) {
      return next({
        statusCode: 500,
        message: "Error getting location coordinates.",
      });
    }

    // Calculate miles
    const miles = await getMiles(originCoords, destinationCoords);

    if (!miles) {
      return next({
        statusCode: 500,
        message: "Error calculating distance.",
      });
    }

    // Get portal
    const portal = await Portal.findById(portalId);
    if (!portal) {
      return next({
        statusCode: 404,
        message: "Portal not found.",
      });
    }

    // Update vehicles with pricing
    const vehicleQuotes = await updateVehiclesWithPricing({
      portal,
      vehicles,
      miles,
      origin: originLocation,
      destination: destinationLocation,
      commission: 0, // Customer quotes typically don't have commission
    });

    // Calculate total pricing
    const totalPricing = await calculateTotalPricing(vehicleQuotes, portal);

    // Create quote
    const quoteData = {
      status: Status.Active,
      portalId,
      isCustomerPortal: true,
      customer: {
        name: customerFullName,
        email: customerEmail?.toLowerCase() || null,
        trackingCode: userFriendlyId,
      },
      origin: {
        userInput: pickup,
        validated: originLocation,
        state: originState,
        coordinates: {
          long: originCoords[0],
          lat: originCoords[1],
        },
      },
      destination: {
        userInput: delivery,
        validated: destinationLocation,
        state: destinationState,
        coordinates: {
          long: destinationCoords[0],
          lat: destinationCoords[1],
        },
      },
      miles,
      transportType: transportType as TransportType,
      vehicles: vehicleQuotes,
      totalPricing,
    };

    const quote = await new Quote(quoteData).save();

    // TODO: Send quote email if customer email provided
    // if (customerEmail) {
    //   try {
    //     const { sendQuoteCustomer } = await import("../notifications/sendQuoteCustomer");
    //     await sendQuoteCustomer(quote);
    //   } catch (emailError) {
    //     logger.warn("Failed to send quote customer email", {
    //       error: emailError instanceof Error ? emailError.message : emailError,
    //       quoteId: quote._id,
    //     });
    //   }
    // }

    logger.info(`Customer created quote ${quote.refId}`, {
      quoteId: quote._id,
      refId: quote.refId,
      trackingCode: userFriendlyId,
    });

    res.status(200).json(quote);
  } catch (error) {
    logger.error("Error creating customer quote", {
      error: error instanceof Error ? error.message : error,
      portalId: req.body?.portalId,
    });
    next({
      statusCode: 500,
      message:
        "Something went wrong calculating this quote. Please try again later or contact us for assistance.",
    });
  }
};

