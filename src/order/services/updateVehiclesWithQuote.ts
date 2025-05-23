import { IVehicle } from "../../_global/interfaces";
import { IQuote } from "../../quote/schema";
import { getServiceLevelValue } from "./getServiceLevelValue";

export const updateVehiclesWithQuote = async ({
  vehicles,
  quote,
  transportType,
}: {
  vehicles: IVehicle[];
  quote: IQuote;
  transportType: string;
}): Promise<any[]> => {
  return quote.vehicles.map((quoteVehicle: IVehicle) => {
    const match = vehicles.find(
      (v) =>
        v.make.toLowerCase() === quoteVehicle.make.toLowerCase() &&
        v.model.toLowerCase() === quoteVehicle.model.toLowerCase(),
    );

    if (match) {
      const serviceLevelFee = quoteVehicle.pricing
        ? getServiceLevelValue(
            quoteVehicle.pricing?.modifiers?.conditional?.serviceLevels,
            "1",
          )
        : 0;

      return {
        ...quoteVehicle,
        pricing: {
          base: {
            tms: 2,
            whiteGlove: 3,
            custom: 4,
          },
          globalModifiers: {
            inoperable: 2,
            discount: -5,
            routes: 15,
            oversize: 10,
          },
          portalModifiers: {
            commission: 10,
            companyTariff: 15,
            discount: -15,
          },
          conditionalModifiers: {
            enclosed: 15,
            serviceLevels: [
              { serviceLevelOption: "1", value: 150 },
              { serviceLevelOption: "3", value: 200 },
              { serviceLevelOption: "5", value: 250 },
              { serviceLevelOption: "7", value: 300 },
            ],
          },
          modifiersTotal: 200,
          total: {
            beforeServiceLevel: 2000,
            serviceLevels: [
              {
                serviceLevelOption: "1",
                enclosed: 2000,
                open: 1500,
              },
            ],
          },
        },
        year: match.year ?? quoteVehicle.year,
        vin: match.vin ?? quoteVehicle.vin,
      };
    }

    return quoteVehicle;
  });
};
