/**
 * Recalculate Existing Quote Rates
 * 
 * Recalculates pricing for an existing quote when transport type changes
 */

import { Quote, Portal, Settings } from "@/_global/models";
import { TransportType } from "../../_global/enums";
import { getMiles } from "./getMiles";
import { updateVehiclesWithPricing } from "./updateVehiclesWithPricing";
import { calculateTotalPricing } from "./calculateTotalPricing";
import { logger } from "@/core/logger";
import { getTransitTimeFromSettings } from "./getTransitTimeFromSettings";

export const recalculateExistingQuote = async (
  quoteId: string,
  transportType: TransportType,
): Promise<any> => {
  try {
    const quote = await Quote.findById(quoteId).populate("portal");

    if (!quote) {
      return null;
    }

    const portal = (quote as any).portal as any;

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
          transitTime: transitTime ?? [],
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
      .populate("portal")
      .populate("user", "firstName lastName")
      .lean();

    if (populatedQuote && (populatedQuote as any).portal && !(populatedQuote as any).portalId) {
      (populatedQuote as any).portalId = (populatedQuote as any).portal;
    }
    if (populatedQuote && (populatedQuote as any).user && !(populatedQuote as any).userId) {
      (populatedQuote as any).userId = (populatedQuote as any).user;
    }

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

