import { IVehicle } from "../../_global/interfaces";
import { IQuote } from "../../quote/schema";
import { getServiceLevelValue } from "./getServiceLevelValue";
import { TransportType } from "../../_global/enums";

export const updateVehiclesWithQuote = async ({
  vehicles,
  quote,
  transportType,
  serviceLevel,
}: {
  vehicles: IVehicle[];
  quote: IQuote;
  transportType: string;
  serviceLevel: string;
}): Promise<any[]> => {
  return quote.vehicles.map((quoteVehicle: IVehicle) => {
    const match = vehicles.find(
      (v) =>
        v.make.toLowerCase() === quoteVehicle.make.toLowerCase() &&
        v.model.toLowerCase() === quoteVehicle.model.toLowerCase(),
    );

    if (match) {
      if (!quoteVehicle.pricing) {
        throw new Error();
      }

      const serviceLevelFee = getServiceLevelValue(
        quoteVehicle.pricing.modifiers.conditional.serviceLevels,
        serviceLevel,
      );

      const enclosedFee =
        transportType === "enclosed"
          ? quoteVehicle.pricing.modifiers.conditional.enclosedFlat +
            quoteVehicle.pricing.modifiers.conditional.enclosedPercent
          : 0;

      const base =
        transportType === TransportType.WhiteGlove
          ? quoteVehicle.pricing.base.whiteGlove
          : quoteVehicle.pricing.base.tms > 0
            ? quoteVehicle.pricing.base.tms
            : quoteVehicle.pricing.base.custom || 0;

      const globalMod = quoteVehicle.pricing.modifiers.global;
      const portalMod = quoteVehicle.pricing.modifiers.portal;

      const modifiers =
        globalMod.inoperable +
        globalMod.oversize +
        globalMod.routes +
        globalMod.states +
        globalMod.vehicles +
        globalMod.discount +
        portalMod.commission +
        portalMod.companyTariff +
        portalMod.discount +
        enclosedFee +
        serviceLevelFee;

      return {
        ...quoteVehicle,
        pricing: {
          base,
          modifiers: {
            global: {
              inoperable: globalMod.inoperable,
              discount: globalMod.discount,
              routes: globalMod.routes,
              states: globalMod.states,
              vehicles: globalMod.vehicles,
              oversize: globalMod.oversize,
            },
            portal: {
              commission: portalMod.commission,
              companyTariff: portalMod.companyTariff,
              discount: portalMod.discount,
            },
            conditional: {
              enclosedFlat:
                quoteVehicle.pricing.modifiers.conditional.enclosedFlat,
              enclosedPercent:
                quoteVehicle.pricing.modifiers.conditional.enclosedPercent,
              serviceLevel: serviceLevelFee,
            },
          },
          totalModifiers: modifiers,
          total: base + modifiers,
          totalTms:
            base + modifiers - portalMod.companyTariff - portalMod.commission,
        },
        year: match.year ?? quoteVehicle.year,
        vin: match.vin ?? quoteVehicle.vin,
      };
    }

    return quoteVehicle;
  });
};
