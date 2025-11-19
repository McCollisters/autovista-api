/**
 * Recalculate Existing Quote Rates
 * 
 * Recalculates pricing for an existing quote when transport type changes
 */

import { Quote, Portal } from "@/_global/models";
import { TransportType } from "../../_global/enums";
import { getMiles } from "./getMiles";
import { updateVehiclesWithPricing } from "./updateVehiclesWithPricing";
import { calculateTotalPricing } from "./calculateTotalPricing";
import { logger } from "@/core/logger";

export const recalculateExistingQuote = async (
  quoteId: string,
  transportType: TransportType,
): Promise<any> => {
  try {
    const quote = await Quote.findById(quoteId).populate("portalId");

    if (!quote) {
      return null;
    }

    const portal = quote.portalId as any;

    // Update transport type
    quote.transportType = transportType;

    // Recalculate miles if needed
    if (quote.origin?.coordinates && quote.destination?.coordinates) {
      const miles = await getMiles(
        quote.origin.coordinates.lat,
        quote.origin.coordinates.long,
        quote.destination.coordinates.lat,
        quote.destination.coordinates.long,
      );
      quote.miles = miles;
    }

    // Update vehicles with new pricing
    const vehiclesWithPricing = await updateVehiclesWithPricing({
      vehicles: quote.vehicles,
      miles: quote.miles || 0,
      origin: quote.origin,
      destination: quote.destination,
      portal,
      commission: (quote as any).commission || 0,
      transportType,
    });

    quote.vehicles = vehiclesWithPricing;

    // Recalculate total pricing
    const totalPricing = await calculateTotalPricing(
      vehiclesWithPricing,
      portal,
    );
    quote.totalPricing = totalPricing;

    // Save updated quote
    await quote.save();

    logger.info("Recalculated existing quote", {
      quoteId: quote._id,
      refId: quote.refId,
      transportType,
    });

    return quote;
  } catch (error) {
    logger.error("Error recalculating existing quote", {
      error: error instanceof Error ? error.message : error,
      quoteId,
      transportType,
    });
    return null;
  }
};

