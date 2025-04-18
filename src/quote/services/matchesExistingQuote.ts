import { IVehicle } from "../../_global/interfaces";
import { IQuote, Quote } from "../../quote/schema";

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
        existing.pricing?.portalModifiers?.commission &&
        existing.pricing?.portalModifiers?.commission !== commission
      ) {
        return null;
      }
    }

    return existingQuote;
  } catch (error) {
    console.error("Error checking for existing quote:", error);
    return null;
  }
};
