import express from "express";
import { Quote } from "../schema";
import { Portal } from "../../portal/schema";
import { Status } from "../../_global/enums";
import { getCoordinates } from "../../_global/utils/location";
import { getMiles } from "../services/getMiles";
import { updateVehiclesWithPricing } from "../services/updateVehiclesWithPricing";
import { calculateTotalPricing } from "../services/calculateTotalPricing";
import { validateLocation } from "../services/validateLocation";

export const createQuote = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const {
      portalId,
      userId,
      customer,
      origin,
      destination,
      transportType,
      vehicles,
      commission,
    } = req.body;

    let originState: string;
    let originLocation: string;
    let destinationState: string;
    let destinationLocation: string;

    const portal = await Portal.findById(portalId);

    if (!portal) {
      return next({ statusCode: 500, message: "Portal not found." });
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
      return next({
        statusCode: 500,
        message: "Error getting location coordinates",
      });
    }

    const miles = await getMiles(originCoords, destinationCoords);

    if (!miles) {
      return next({ statusCode: 500, message: "Error getting miles" });
    }

    const vehicleQuotes = await updateVehiclesWithPricing({
      portal,
      vehicles,
      miles,
      origin: originLocation,
      originState,
      destination: destinationLocation,
      destinationState,
      commission,
    });
    const totalPricing = await calculateTotalPricing(vehicleQuotes);

    const formattedQuote = {
      status: Status.Active,
      portalId,
      userId,
      customer,
      origin: {
        userInput: origin,
        validated: originLocation,
        long: originCoords[0],
        lat: originCoords[1],
        state: originState,
      },
      destination: {
        userInput: destination,
        validated: destinationLocation,
        long: destinationCoords[0],
        lat: destinationCoords[1],
        state: destinationState,
      },
      miles,
      transportType,
      vehicles: vehicleQuotes,
      totalPricing,
    };

    const createdQuote = await new Quote(formattedQuote).save();
    res.status(200).send(createdQuote);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
