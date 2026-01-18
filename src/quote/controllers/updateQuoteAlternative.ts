import express from "express";
import { Quote, Portal, ModifierSet, Settings } from "@/_global/models";
import { TransportType } from "../../_global/enums";
import { getCoordinates } from "../../_global/utils/location";
import { getMiles } from "../services/getMiles";
import { updateVehiclesWithPricing } from "../services/updateVehiclesWithPricing";
import { calculateTotalPricing } from "../services/calculateTotalPricing";
import { validateLocation } from "../services/validateLocation";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
import { getTransitTimeFromSettings } from "../services/getTransitTimeFromSettings";

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

    const originalQuote = await Quote.findById(quoteId).populate("portal");

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

    const portal = (originalQuote as any).portal as any;

    // Use provided values or fall back to existing quote values
    // Extract base commission from existing quote if not provided
    // The stored commission in totalPricing.modifiers.commission is the TOTAL commission (includes fixedCommission),
    // and it's the sum across all vehicles. We need the BASE commission per vehicle.
    let finalCommission = 0;
    if (commission !== undefined && commission !== null) {
      finalCommission = parseInt(String(commission), 10);
    } else {
      // Try to extract base commission from existing vehicle pricing
      // Each vehicle has pricing.modifiers.commission which is the calculated commission (base + fixedCommission)
      // We need to reverse-engineer the base commission by subtracting fixedCommission
      if (originalQuote.vehicles && originalQuote.vehicles.length > 0) {
        const firstVehicle = originalQuote.vehicles[0];
        const vehicleCommission = (firstVehicle as any).pricing?.modifiers?.commission || 0;
        const vehicleBase = (firstVehicle as any).pricing?.base || 0;
        
        // Get portal modifiers to calculate fixedCommission
        const portalModifiers = await ModifierSet.findOne({
          portal: portal._id,
        }).lean() as any;
        
        if (portalModifiers?.fixedCommission && vehicleCommission > 0 && vehicleBase > 0) {
          // Calculate what fixedCommission would be for this vehicle's base rate
          const fixedCommissionValue = portalModifiers.fixedCommission.valueType === "percentage"
            ? Math.ceil(vehicleBase * (portalModifiers.fixedCommission.value / 100))
            : (portalModifiers.fixedCommission.value || 0);
          
          // Extract base commission by subtracting fixedCommission
          finalCommission = Math.max(0, vehicleCommission - fixedCommissionValue);
        } else if (vehicleCommission > 0) {
          // If no fixedCommission, the vehicle commission IS the base commission
          finalCommission = vehicleCommission;
        }
        // If vehicleCommission is 0, finalCommission stays 0
      }
    }

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

    // Format locations for API calls: use validated location if available, otherwise construct from user input and state
    const formatLocationForAPI = (
      validatedLocation: string | null,
      userInput: string,
      state: string | null,
    ): string => {
      if (validatedLocation) {
        return validatedLocation;
      }
      // If we have state, try to construct "City, State" format
      if (state) {
        // If userInput already contains a comma, use it as-is (might already be "City, State")
        if (userInput.includes(",")) {
          return userInput.trim();
        }
        // Otherwise, try to extract city from userInput and add state
        const city = userInput.trim();
        return `${city}, ${state}`;
      }
      // Fallback to userInput if no state available
      return userInput.trim();
    };

    const originFormatted = formatLocationForAPI(
      originValidated.location,
      finalPickup,
      originValidated.state,
    );
    const destinationFormatted = formatLocationForAPI(
      destinationValidated.location,
      finalDelivery,
      destinationValidated.state,
    );

    // Normalize vehicles
    const normalizedVehicles = finalVehicles.map((v: any) => {
      const isOperable = !(
        v.operable === "No" ||
        v.operable === false ||
        v.operable === "false" ||
        v.operable?.value === "No"
      );
      
      // Extract make - handle both string and object formats
      let make = v.make;
      if (make && typeof make === 'object') {
        make = make.value || make.label || make;
      }
      
      // Extract model - handle both string and object formats
      let model = v.model;
      if (model && typeof model === 'object') {
        model = model.value || model.label || model;
      }
      
      // Extract pricingClass if provided in model object
      let pricingClass = v.pricingClass;
      if (model && typeof model === 'object' && model.pricingClass) {
        pricingClass = model.pricingClass;
      }
      
      return {
        ...v,
        make: typeof make === 'string' ? make : String(make),
        model: typeof model === 'string' ? model : String(model),
        pricingClass: pricingClass || v.pricingClass,
        isInoperable: !isOperable,
      };
    });

    // Get coordinates
    const originCoords = await getCoordinates(originFormatted);
    const destinationCoords = await getCoordinates(destinationFormatted);

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

    let transitTime: [number, number] | null = null;
    try {
      const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
      const transitTimes = Array.isArray(settings?.transitTimes)
        ? settings.transitTimes
        : [];
      transitTime = getTransitTimeFromSettings(miles, transitTimes);
    } catch (error) {
      transitTime = null;
    }

    // Update vehicles with pricing
    const vehicleQuotes = await updateVehiclesWithPricing({
      portal,
      vehicles: normalizedVehicles,
      miles,
      origin: originFormatted,
      destination: destinationFormatted,
      commission: finalCommission,
    });

    // Calculate total pricing
    const totalPricing = await calculateTotalPricing(vehicleQuotes, portal);

    // Update quote
    originalQuote.origin = {
      userInput: finalPickup,
      validated: originFormatted,
      state: originValidated.state as any,
      coordinates: {
        long: originCoords[0].toString(),
        lat: originCoords[1].toString(),
      },
    };

    originalQuote.destination = {
      userInput: finalDelivery,
      validated: destinationFormatted,
      state: destinationValidated.state as any,
      coordinates: {
        long: destinationCoords[0].toString(),
        lat: destinationCoords[1].toString(),
      },
    };

    originalQuote.miles = miles;
    originalQuote.transitTime = transitTime ?? [];
    // Only update transportType if it was provided in the request
    if (transportType !== undefined) {
      originalQuote.transportType = finalTransportType as TransportType;
    }
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

