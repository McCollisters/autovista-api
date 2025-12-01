import express from "express";
import { Quote, Portal } from "@/_global/models";
import { TransportType } from "../../_global/enums";
import { getCoordinates } from "../../_global/utils/location";
import { getMiles } from "../services/getMiles";
import { updateVehiclesWithPricing } from "../services/updateVehiclesWithPricing";
import { calculateTotalPricing } from "../services/calculateTotalPricing";
import { validateLocation } from "../services/validateLocation";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";

/**
 * PUT /api/v1/quote
 * Update quote (alternative endpoint - takes quoteId in body instead of params)
 * 
 * Similar to PATCH /api/v1/quote/:quoteId but allows quoteId in request body
 */
export const updateQuoteAlternative = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<express.Response | void> => {
  try {
    const {
      customerFullName,
      commission,
      pickup,
      delivery,
      vehicles,
      transportType,
      quoteId,
      status,
    } = req.body;

    if (!quoteId) {
      return next({
        statusCode: 400,
        message: "Quote ID is required.",
      });
    }

    const authHeader = req.headers.authorization;
    const user = (req as any).user ?? (await getUserFromToken(authHeader));

    if (!user) {
      return next({
        statusCode: 401,
        message: "Unauthorized",
      });
    }

    const originalQuote = await Quote.findById(quoteId).populate("portalId");

    if (!originalQuote) {
      return next({
        statusCode: 404,
        message: "Quote not found.",
      });
    }

    logger.info(`User ${user.email} updating quote ${quoteId}`, {
      userId: user._id,
      quoteId,
      changes: Object.keys(req.body),
    });

    // If only status is being updated
    if (
      status &&
      quoteId &&
      !vehicles &&
      !pickup &&
      !delivery &&
      !transportType
    ) {
      originalQuote.status = status as any;
      if (status.toLowerCase() === "archived") {
        (originalQuote as any).archivedAt = new Date();
      } else if (status.toLowerCase() === "saved") {
        (originalQuote as any).savedAt = new Date();
      }

      const updated = await originalQuote.save();
      return res.status(200).json(updated);
    }

    const portal = originalQuote.portalId as any;

    // Use provided values or fall back to existing quote values
    const finalCommission =
      commission !== undefined && commission !== null
        ? parseInt(String(commission), 10)
        : (originalQuote as any).commission || 0;

    const finalVehicles = vehicles || originalQuote.vehicles;
    const finalPickup = pickup || originalQuote.origin?.userInput;
    const finalDelivery = delivery || originalQuote.destination?.userInput;
    const finalTransportType =
      transportType?.value || transportType || originalQuote.transportType;

    // Validate locations
    const originValidated = await validateLocation(finalPickup);
    if (originValidated.error) {
      return next({
        statusCode: 400,
        message: originValidated.error,
      });
    }

    const destinationValidated = await validateLocation(finalDelivery);
    if (destinationValidated.error) {
      return next({
        statusCode: 400,
        message: destinationValidated.error,
      });
    }

    // Normalize vehicles
    const normalizedVehicles = finalVehicles.map((v: any) => {
      const isOperable = !(
        v.operable === "No" ||
        v.operable === false ||
        v.operable === "false" ||
        v.operable?.value === "No"
      );
      return {
        ...v,
        isInoperable: !isOperable,
      };
    });

    // Get coordinates
    const originCoords = await getCoordinates(originValidated.location || finalPickup);
    const destinationCoords = await getCoordinates(
      destinationValidated.location || finalDelivery,
    );

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

    // Update vehicles with pricing
    const vehicleQuotes = await updateVehiclesWithPricing({
      portal,
      vehicles: normalizedVehicles,
      miles,
      origin: originValidated.location || finalPickup,
      destination: destinationValidated.location || finalDelivery,
      commission: finalCommission,
    });

    // Calculate total pricing
    const totalPricing = await calculateTotalPricing(vehicleQuotes, portal);

    // Update quote
    originalQuote.origin = {
      userInput: finalPickup,
      validated: originValidated.location || finalPickup,
      state: originValidated.state as any,
      coordinates: {
        long: originCoords[0].toString(),
        lat: originCoords[1].toString(),
      },
    };

    originalQuote.destination = {
      userInput: finalDelivery,
      validated: destinationValidated.location || finalDelivery,
      state: destinationValidated.state as any,
      coordinates: {
        long: destinationCoords[0].toString(),
        lat: destinationCoords[1].toString(),
      },
    };

    originalQuote.miles = miles;
    originalQuote.transportType = finalTransportType as TransportType;
    originalQuote.vehicles = vehicleQuotes;
    originalQuote.totalPricing = totalPricing;

    if (customerFullName !== undefined) {
      if (originalQuote.customer) {
        originalQuote.customer.name = customerFullName || null;
      } else {
        (originalQuote as any).customer = { name: customerFullName || null };
      }
    }

    if (status) {
      originalQuote.status = status as any;
    }

    const updatedQuote = await originalQuote.save();

    logger.info("Quote updated successfully", {
      quoteId: updatedQuote._id,
      refId: updatedQuote.refId,
    });

    res.status(200).json(updatedQuote);
  } catch (error) {
    logger.error("Error updating quote", {
      error: error instanceof Error ? error.message : error,
      quoteId: req.body?.quoteId,
    });
    next({
      statusCode: 500,
      message:
        "Something went wrong calculating this quote. Please try again later or contact us for assistance.",
    });
  }
};

