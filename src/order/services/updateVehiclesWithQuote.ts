import { IVehicle } from "../../_global/interfaces";
import { IQuote } from "@/_global/models";
import { getServiceLevelValue } from "./getServiceLevelValue";
import { TransportType, ServiceLevelOption } from "../../_global/enums";

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
        throw new Error("Quote vehicle pricing is required");
      }

      // Get service level fee from the new structure
      const serviceLevelFee = getServiceLevelValue(
        quoteVehicle.pricing.modifiers.serviceLevels || [],
        serviceLevel,
      );

      // Calculate enclosed fees from the new flat structure
      const enclosedFee =
        transportType === "enclosed"
          ? (quoteVehicle.pricing.modifiers.enclosedFlat || 0) +
            (quoteVehicle.pricing.modifiers.enclosedPercent || 0)
          : 0;

      // Get base from the new structure
      const base =
        transportType === TransportType.WhiteGlove
          ? quoteVehicle.pricing.base?.whiteGlove || 0
          : quoteVehicle.pricing.base?.tms > 0
            ? quoteVehicle.pricing.base.tms
            : quoteVehicle.pricing.base?.custom || 0;

      // Get modifiers from the new flat structure
      const modifiers = quoteVehicle.pricing.modifiers;

      // Calculate total modifiers
      const totalModifiers =
        (modifiers.inoperable || 0) +
        (modifiers.oversize || 0) +
        (modifiers.routes || 0) +
        (modifiers.states || 0) +
        (modifiers.vehicles || 0) +
        (modifiers.globalDiscount || 0) +
        (modifiers.portalDiscount || 0) +
        (modifiers.irr || 0) +
        (modifiers.fuel || 0) +
        (modifiers.commission || 0) +
        enclosedFee +
        serviceLevelFee;

      // Get service level totals from the new structure
      const getServiceLevelTotals = (serviceLevel: string) => {
        if (!quoteVehicle.pricing?.totals) return 0;

        switch (serviceLevel) {
          case ServiceLevelOption.WhiteGlove:
            return quoteVehicle.pricing.totals.whiteGlove || 0;
          case ServiceLevelOption.OneDay:
            return transportType === "enclosed"
              ? quoteVehicle.pricing.totals.one.enclosed.total || 0
              : quoteVehicle.pricing.totals.one.open.total || 0;
          case ServiceLevelOption.ThreeDay:
            return quoteVehicle.pricing.totals.three.total || 0;
          case ServiceLevelOption.FiveDay:
            return quoteVehicle.pricing.totals.five.total || 0;
          case ServiceLevelOption.SevenDay:
            return quoteVehicle.pricing.totals.seven.total || 0;
          default:
            return 0;
        }
      };

      // Get company tariff and commission from service level totals
      const getCompanyTariffAndCommission = (serviceLevel: string) => {
        if (!quoteVehicle.pricing?.totals)
          return { companyTariff: 0, commission: 0 };

        switch (serviceLevel) {
          case ServiceLevelOption.OneDay:
            return transportType === "enclosed"
              ? {
                  companyTariff:
                    quoteVehicle.pricing.totals.one.enclosed.companyTariff || 0,
                  commission:
                    quoteVehicle.pricing.totals.one.enclosed.commission || 0,
                }
              : {
                  companyTariff:
                    quoteVehicle.pricing.totals.one.open.companyTariff || 0,
                  commission:
                    quoteVehicle.pricing.totals.one.open.commission || 0,
                };
          case ServiceLevelOption.ThreeDay:
            return {
              companyTariff:
                quoteVehicle.pricing.totals.three.companyTariff || 0,
              commission: quoteVehicle.pricing.totals.three.commission || 0,
            };
          case ServiceLevelOption.FiveDay:
            return {
              companyTariff:
                quoteVehicle.pricing.totals.five.companyTariff || 0,
              commission: quoteVehicle.pricing.totals.five.commission || 0,
            };
          case ServiceLevelOption.SevenDay:
            return {
              companyTariff:
                quoteVehicle.pricing.totals.seven.companyTariff || 0,
              commission: quoteVehicle.pricing.totals.seven.commission || 0,
            };
          default:
            return { companyTariff: 0, commission: 0 };
        }
      };

      const serviceLevelTotals = getServiceLevelTotals(serviceLevel);
      const { companyTariff, commission } =
        getCompanyTariffAndCommission(serviceLevel);

      return {
        ...quoteVehicle,
        pricing: {
          base,
          modifiers: {
            inoperable: modifiers.inoperable || 0,
            routes: modifiers.routes || 0,
            states: modifiers.states || 0,
            oversize: modifiers.oversize || 0,
            vehicles: modifiers.vehicles || 0,
            globalDiscount: modifiers.globalDiscount || 0,
            portalDiscount: modifiers.portalDiscount || 0,
            irr: modifiers.irr || 0,
            fuel: modifiers.fuel || 0,
            enclosedFlat:
              transportType === "enclosed" ? modifiers.enclosedFlat || 0 : 0,
            enclosedPercent:
              transportType === "enclosed" ? modifiers.enclosedPercent || 0 : 0,
            commission: commission,
            serviceLevels: modifiers.serviceLevels || [],
            companyTariffs: modifiers.companyTariffs || [],
          },
          totals: {
            whiteGlove: quoteVehicle.pricing.totals.whiteGlove || 0,
            one: {
              open: {
                total: quoteVehicle.pricing.totals.one.open.total || 0,
                companyTariff:
                  quoteVehicle.pricing.totals.one.open.companyTariff || 0,
                commission:
                  quoteVehicle.pricing.totals.one.open.commission || 0,
                totalWithCompanyTariffAndCommission:
                  quoteVehicle.pricing.totals.one.open
                    .totalWithCompanyTariffAndCommission || 0,
              },
              enclosed: {
                total: quoteVehicle.pricing.totals.one.enclosed.total || 0,
                companyTariff:
                  quoteVehicle.pricing.totals.one.enclosed.companyTariff || 0,
                commission:
                  quoteVehicle.pricing.totals.one.enclosed.commission || 0,
                totalWithCompanyTariffAndCommission:
                  quoteVehicle.pricing.totals.one.enclosed
                    .totalWithCompanyTariffAndCommission || 0,
              },
            },
            three: {
              total: quoteVehicle.pricing.totals.three.total || 0,
              companyTariff:
                quoteVehicle.pricing.totals.three.companyTariff || 0,
              commission: quoteVehicle.pricing.totals.three.commission || 0,
              totalWithCompanyTariffAndCommission:
                quoteVehicle.pricing.totals.three
                  .totalWithCompanyTariffAndCommission || 0,
            },
            five: {
              total: quoteVehicle.pricing.totals.five.total || 0,
              companyTariff:
                quoteVehicle.pricing.totals.five.companyTariff || 0,
              commission: quoteVehicle.pricing.totals.five.commission || 0,
              totalWithCompanyTariffAndCommission:
                quoteVehicle.pricing.totals.five
                  .totalWithCompanyTariffAndCommission || 0,
            },
            seven: {
              total: quoteVehicle.pricing.totals.seven.total || 0,
              companyTariff:
                quoteVehicle.pricing.totals.seven.companyTariff || 0,
              commission: quoteVehicle.pricing.totals.seven.commission || 0,
              totalWithCompanyTariffAndCommission:
                quoteVehicle.pricing.totals.seven
                  .totalWithCompanyTariffAndCommission || 0,
            },
          },
        },
        year: match.year ?? quoteVehicle.year,
        vin: match.vin ?? quoteVehicle.vin,
      };
    }

    return quoteVehicle;
  });
};
