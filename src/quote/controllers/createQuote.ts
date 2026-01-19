import express from "express";
import { Quote, Portal, Settings } from "@/_global/models";
import { Status } from "../../_global/enums";
import { getCoordinates } from "../../_global/utils/location";
import { getMiles } from "../services/getMiles";
import { updateVehiclesWithPricing } from "../services/updateVehiclesWithPricing";
import { calculateTotalPricing } from "../services/calculateTotalPricing";
import { validateLocation } from "../services/validateLocation";
import { matchesExistingQuote } from "../services/matchesExistingQuote";
import { getTransitTimeFromSettings } from "../services/getTransitTimeFromSettings";
import { resolveId } from "@/_global/utils/resolveId";

export const createQuote = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { customer, origin, destination, vehicles, commission } = req.body;
    const userId = resolveId(req.body?.user ?? req.body?.userId);
    const portalId = resolveId(req.body?.portal ?? req.body?.portalId);

    const existingQuote = await matchesExistingQuote(
      origin,
      destination,
      portalId,
      vehicles,
      commission,
    );

    if (existingQuote) {
      const hasTransitTime =
        Array.isArray(existingQuote.transitTime) &&
        existingQuote.transitTime.length >= 2;
      if (!hasTransitTime) {
        try {
          const settings = await Settings.findOne({});
          const transitTimes = Array.isArray(settings?.transitTimes)
            ? settings?.transitTimes ?? []
            : [];
          const fallbackTransitTime = getTransitTimeFromSettings(
            existingQuote.miles || 0,
            transitTimes,
          );
          if (fallbackTransitTime) {
            existingQuote.transitTime = fallbackTransitTime;
            await existingQuote.save();
          }
        } catch (error) {
          // If settings lookup fails, return existing quote unchanged.
        }
      }
      res.status(200).json(existingQuote);
      return;
    }

    let originState: string;
    let originLocation: string;
    let destinationState: string;
    let destinationLocation: string;

    const portal = await Portal.findById(portalId);

    if (!portal) {
      return next({ statusCode: 404, message: "Portal not found." });
    }

    const originValidated = await validateLocation(origin);
    if (originValidated.error) {
      return next({ statusCode: 500, message: originValidated.error });
    }

    originState = originValidated.state || "";
    originLocation = originValidated.location || origin;

    const destinationValidated = await validateLocation(destination);
    if (destinationValidated.error) {
      return next({ statusCode: 500, message: destinationValidated.error });
    }

    destinationState = destinationValidated.state || "";
    destinationLocation = destinationValidated.location || destination;

    const originCoords = await getCoordinates(originLocation);
    const destinationCoords = await getCoordinates(destinationLocation);

    if (!originCoords || !destinationCoords) {
      return next(new Error("Error getting location coordinates."));
    }

    const miles = await getMiles(originCoords, destinationCoords);

    if (!miles) {
      return next(new Error("Error calculating distance."));
    }

    let transitTime: [number, number] | null = null;
    try {
      const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
      const transitTimes = Array.isArray(settings?.transitTimes)
        ? settings?.transitTimes ?? []
        : [];
      transitTime = getTransitTimeFromSettings(miles, transitTimes);
    } catch (error) {
      transitTime = null;
    }

    const normalizedVehicles = Array.isArray(vehicles)
      ? vehicles.map((v: any) => {
          const hasExplicitInoperable =
            typeof v.isInoperable === "boolean" ? v.isInoperable : undefined;
          const isOperable =
            hasExplicitInoperable !== undefined
              ? !hasExplicitInoperable
              : !(
                  v.operable === "No" ||
                  v.operable === false ||
                  v.operable === "false" ||
                  v.operable?.value === "No"
                );

          let make = v.make;
          if (make && typeof make === "object") {
            make = make.value || make.label || make;
          }

          let model = v.model;
          if (model && typeof model === "object") {
            model = model.value || model.label || model;
          }

          let pricingClass = v.pricingClass;
          if (model && typeof model === "object" && model.pricingClass) {
            pricingClass = model.pricingClass;
          }

          return {
            ...v,
            make: typeof make === "string" ? make : String(make),
            model: typeof model === "string" ? model : String(model),
            pricingClass: pricingClass || v.pricingClass,
            isInoperable: !isOperable,
          };
        })
      : vehicles;

    const vehicleQuotes = await updateVehiclesWithPricing({
      portal,
      vehicles: normalizedVehicles,
      miles,
      origin: originLocation,
      destination: destinationLocation,
      commission,
    });

    const totalPricing = await calculateTotalPricing(vehicleQuotes, portal);

    const formattedQuote = {
      status: Status.Active,
      portal: portalId,
      user: userId,
      customer,
      origin: {
        userInput: origin,
        validated: originLocation,
        state: originState,
        coordinates: {
          long: originCoords[0],
          lat: originCoords[1],
        },
      },
      destination: {
        userInput: destination,
        validated: destinationLocation,
        state: destinationState,
        coordinates: {
          long: destinationCoords[0],
          lat: destinationCoords[1],
        },
      },
      miles,
      transitTime: transitTime ?? [],
      vehicles: vehicleQuotes,
      totalPricing,
    };

    const createdQuote = await new Quote(formattedQuote).save();

    console.log("createdQuote", createdQuote);

    res.status(200).json(createdQuote);

    // Send relevant notifications
  } catch (error) {
    next(error);
  }
};
