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

    // Get vehicles as plain objects (like createQuote does)
    const vehicles = quote.vehicles.map((v: any) => {
      const vehicle = v.toObject ? v.toObject() : v;
      return vehicle;
    });

    // Recalculate miles if needed
    let miles = quote.miles || 0;
    if (quote.origin?.coordinates && quote.destination?.coordinates) {
      miles = await getMiles(
        [parseFloat(quote.origin.coordinates.lat), parseFloat(quote.origin.coordinates.long)],
        [parseFloat(quote.destination.coordinates.lat), parseFloat(quote.destination.coordinates.long)],
      );
    }

    // Update vehicles with new pricing (like createQuote does - vehicles don't need transportType set)
    const commission = (quote.totalPricing?.modifiers?.commission) || 0;
    const vehiclesWithPricing = await updateVehiclesWithPricing({
      vehicles,
      miles,
      origin: quote.origin?.validated || '',
      destination: quote.destination?.validated || '',
      portal,
      commission,
    });

    // Recalculate total pricing
    const totalPricing = await calculateTotalPricing(
      vehiclesWithPricing,
      portal,
    );

    // Update quote using updateOne to avoid validation issues (like createQuote creates new quote)
    await Quote.updateOne(
      { _id: quoteId },
      {
        $set: {
          transportType,
          vehicles: vehiclesWithPricing,
          totalPricing,
          miles,
        },
      }
    );

    logger.info("Recalculated existing quote", {
      quoteId: quote._id,
      refId: quote.refId,
      transportType,
    });

    // Populate and return quote in same format as getQuote
    const populatedQuote = await Quote.findById(quoteId)
      .populate("portalId")
      .populate("userId", "firstName lastName")
      .lean();

    return populatedQuote;
  } catch (error) {
    logger.error("Error recalculating existing quote", {
      error: error instanceof Error ? error.message : error,
      quoteId,
      transportType,
    });
    return null;
  }
};

