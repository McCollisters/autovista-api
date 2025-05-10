import { IVehicle } from "../../_global/interfaces";
import { IQuote } from "../../quote/schema";

export const updateVehiclesWithQuote = async ({
  vehicles,
  quote,
}: {
  vehicles: IVehicle[];
  quote: IQuote;
}): Promise<IVehicle[]> => {
  return quote.vehicles.map((quoteVehicle: IVehicle) => {
    const match = vehicles.find(
      (v) =>
        v.make.toLowerCase() === quoteVehicle.make.toLowerCase() &&
        v.model.toLowerCase() === quoteVehicle.model.toLowerCase(),
    );

    if (match) {
      return {
        ...quoteVehicle,
        year: match.year ?? quoteVehicle.year,
        vin: match.vin ?? quoteVehicle.vin,
      };
    }

    return quoteVehicle;
  });
};
