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

      // Get base from the new structure
      const base =
        transportType === TransportType.WhiteGlove
          ? quoteVehicle.pricing.base?.whiteGlove || 0
          : quoteVehicle.pricing.base?.tms > 0
            ? quoteVehicle.pricing.base.tms
            : quoteVehicle.pricing.base?.custom || 0;

      // Get service level fee from the new structure
      const serviceLevelFee = getServiceLevelValue(
        quoteVehicle.pricing.modifiers.serviceLevels || [],
        serviceLevel,
      );

      // Calculate enclosed fees: flat + percent of base
      const enclosedPercentRaw =
        quoteVehicle.pricing.modifiers.enclosedPercent || 0;
      const enclosedPercentFee = Math.ceil(
        base * (Number(enclosedPercentRaw) / 100),
      );
      const enclosedFee =
        transportType === "enclosed"
          ? (quoteVehicle.pricing.modifiers.enclosedFlat || 0) +
            enclosedPercentFee
          : 0;

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

      const useEnclosedTotals = transportType === "enclosed";

      const getServiceLevelTotals = (serviceLevel: string) => {
        const totals = quoteVehicle.pricing?.totals;
        if (!totals) return 0;
        const totalsAny = totals as any;

        switch (serviceLevel) {
          case ServiceLevelOption.WhiteGlove:
            return totals.whiteGlove || 0;
          case ServiceLevelOption.OneDay:
            return useEnclosedTotals
              ? totals.one.enclosed.total || 0
              : totals.one.open.total || 0;
          case ServiceLevelOption.ThreeDay:
            return useEnclosedTotals
              ? totalsAny.three?.enclosed?.total ?? totals.three?.total ?? 0
              : totalsAny.three?.open?.total ?? totals.three?.total ?? 0;
          case ServiceLevelOption.FiveDay:
            return useEnclosedTotals
              ? totalsAny.five?.enclosed?.total ?? totals.five?.total ?? 0
              : totalsAny.five?.open?.total ?? totals.five?.total ?? 0;
          case ServiceLevelOption.SevenDay:
            return useEnclosedTotals
              ? totalsAny.seven?.enclosed?.total ?? totals.seven?.total ?? 0
              : totalsAny.seven?.open?.total ?? totals.seven?.total ?? 0;
          default:
            return 0;
        }
      };

      const getServiceLevelField = (
        serviceLevel: string,
        field:
          | "total"
          | "companyTariff"
          | "commission"
          | "totalWithCompanyTariffAndCommission",
      ) => {
        const totals = quoteVehicle.pricing?.totals;
        if (!totals) return 0;
        const totalsAny = totals as any;

        switch (serviceLevel) {
          case ServiceLevelOption.ThreeDay: {
            const level = totalsAny.three;
            return useEnclosedTotals
              ? level?.enclosed?.[field] ?? level?.[field] ?? 0
              : level?.open?.[field] ?? level?.[field] ?? 0;
          }
          case ServiceLevelOption.FiveDay: {
            const level = totalsAny.five;
            return useEnclosedTotals
              ? level?.enclosed?.[field] ?? level?.[field] ?? 0
              : level?.open?.[field] ?? level?.[field] ?? 0;
          }
          case ServiceLevelOption.SevenDay: {
            const level = totalsAny.seven;
            return useEnclosedTotals
              ? level?.enclosed?.[field] ?? level?.[field] ?? 0
              : level?.open?.[field] ?? level?.[field] ?? 0;
          }
          default:
            return 0;
        }
      };

      const getCompanyTariffAndCommission = (serviceLevel: string) => {
        const totals = quoteVehicle.pricing?.totals;
        if (!totals) return { companyTariff: 0, commission: 0 };

        switch (serviceLevel) {
          case ServiceLevelOption.OneDay:
            return useEnclosedTotals
              ? {
                  companyTariff: totals.one.enclosed.companyTariff || 0,
                  commission: totals.one.enclosed.commission || 0,
                }
              : {
                  companyTariff: totals.one.open.companyTariff || 0,
                  commission: totals.one.open.commission || 0,
                };
          case ServiceLevelOption.ThreeDay:
            return {
              companyTariff: getServiceLevelField(
                ServiceLevelOption.ThreeDay,
                "companyTariff",
              ),
              commission: getServiceLevelField(
                ServiceLevelOption.ThreeDay,
                "commission",
              ),
            };
          case ServiceLevelOption.FiveDay:
            return {
              companyTariff: getServiceLevelField(
                ServiceLevelOption.FiveDay,
                "companyTariff",
              ),
              commission: getServiceLevelField(
                ServiceLevelOption.FiveDay,
                "commission",
              ),
            };
          case ServiceLevelOption.SevenDay:
            return {
              companyTariff: getServiceLevelField(
                ServiceLevelOption.SevenDay,
                "companyTariff",
              ),
              commission: getServiceLevelField(
                ServiceLevelOption.SevenDay,
                "commission",
              ),
            };
          default:
            return { companyTariff: 0, commission: 0 };
        }
      };

      const serviceLevelTotals = getServiceLevelTotals(serviceLevel);
      const { companyTariff, commission } =
        getCompanyTariffAndCommission(serviceLevel);

      const companyTariffs = useEnclosedTotals
        ? [
            {
              serviceLevelOption: ServiceLevelOption.OneDay,
              value:
                quoteVehicle.pricing.totals.one.enclosed.companyTariff || 0,
            },
            {
              serviceLevelOption: ServiceLevelOption.ThreeDay,
              value: getServiceLevelField(
                ServiceLevelOption.ThreeDay,
                "companyTariff",
              ),
            },
            {
              serviceLevelOption: ServiceLevelOption.FiveDay,
              value: getServiceLevelField(
                ServiceLevelOption.FiveDay,
                "companyTariff",
              ),
            },
            {
              serviceLevelOption: ServiceLevelOption.SevenDay,
              value: getServiceLevelField(
                ServiceLevelOption.SevenDay,
                "companyTariff",
              ),
            },
          ]
        : modifiers.companyTariffs || [];

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
            companyTariffs,
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
              total: getServiceLevelField(ServiceLevelOption.ThreeDay, "total"),
              companyTariff: getServiceLevelField(
                ServiceLevelOption.ThreeDay,
                "companyTariff",
              ),
              commission: getServiceLevelField(
                ServiceLevelOption.ThreeDay,
                "commission",
              ),
              totalWithCompanyTariffAndCommission: getServiceLevelField(
                ServiceLevelOption.ThreeDay,
                "totalWithCompanyTariffAndCommission",
              ),
            },
            five: {
              total: getServiceLevelField(ServiceLevelOption.FiveDay, "total"),
              companyTariff: getServiceLevelField(
                ServiceLevelOption.FiveDay,
                "companyTariff",
              ),
              commission: getServiceLevelField(
                ServiceLevelOption.FiveDay,
                "commission",
              ),
              totalWithCompanyTariffAndCommission: getServiceLevelField(
                ServiceLevelOption.FiveDay,
                "totalWithCompanyTariffAndCommission",
              ),
            },
            seven: {
              total: getServiceLevelField(ServiceLevelOption.SevenDay, "total"),
              companyTariff: getServiceLevelField(
                ServiceLevelOption.SevenDay,
                "companyTariff",
              ),
              commission: getServiceLevelField(
                ServiceLevelOption.SevenDay,
                "commission",
              ),
              totalWithCompanyTariffAndCommission: getServiceLevelField(
                ServiceLevelOption.SevenDay,
                "totalWithCompanyTariffAndCommission",
              ),
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
