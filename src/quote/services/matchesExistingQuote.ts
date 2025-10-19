import { IVehicle } from "../../_global/interfaces";
import { IQuote } from "@/_global/models";
import { Quote } from "@/_global/models";

export const matchesExistingQuote = async (
  origin: string,
  destination: string,
  portalId: string,
  vehicles: IVehicle[],
  commission: number,
): Promise<IQuote | null> => {
  if (!origin || !vehicles || !Array.isArray(vehicles)) {
    return null;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const existingQuote = await Quote.findOne({
      "origin.userInput": origin,
      "destination.userInput": destination,
      portalId,
      createdAt: { $gte: thirtyDaysAgo },
    });

    if (!existingQuote || existingQuote.vehicles.length !== vehicles.length) {
      return null;
    }

    for (let i = 0; i < existingQuote.vehicles.length; i++) {
      const existing = existingQuote.vehicles[i];
      const incoming = vehicles[i];

      if (
        !incoming ||
        existing.make !== incoming.make ||
        existing.model !== incoming.model
      ) {
        return null;
      }

      if (
        existing.pricing?.modifiers.commission &&
        existing.pricing?.modifiers.commission !== commission
      ) {
        return null;
      }
    }

    return existingQuote;
  } catch (error) {
    return null;
  }
};
