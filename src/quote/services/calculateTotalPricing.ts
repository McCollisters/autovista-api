import { ServiceLevelOption } from "../../_global/enums";
import { IVehicle, IPricingQuote } from "../../_global/interfaces";
import { IPortal } from "@/_global/models";
import { roundCurrency } from "../../_global/utils/roundCurrency";

export const calculateTotalPricing = async (
  vehicles: IVehicle[],
  portal: IPortal,
): Promise<any> => {
  let baseTms = 0;
  let baseWhiteGlove = 0;
  let baseCustom = 0;

  let conditionalEnclosedFlat = 0;
  let conditionalEnclosedPercent = 0;
  let totalModifiers = 0;
  let withoutServiceLevel = {
    open: 0,
    enclosed: 0,
  };
  let globalInop = 0;
  let globalDiscount = 0;
  let globalRoutes = 0;
  let globalStates = 0;
  let globalVehicles = 0;
  let globalOversize = 0;
  let portalCommission = 0;
  let portalCompanyTariff = 0;
  let portalDiscount = 0;

  if (!vehicles || vehicles.length === 0) {
    return {
      base: 0,
      modifiers: {
        inoperable: 0,
        oversize: 0,
        globalDiscount: 0,
        routes: 0,
        states: 0,
        vehicles: 0,
        portalDiscount: 0,
        commission: 0,
        companyTariffs: [],
        irr: 0,
        fuel: 0,
        enclosedFlat: 0,
        enclosedPercent: 0,
        serviceLevels: [],
      },
      totals: {
        whiteGlove: 0,
        one: {
          open: {
            total: 0,
            companyTariff: 0,
            commission: 0,
            totalWithCompanyTariffAndCommission: 0,
          },
          enclosed: {
            total: 0,
            companyTariff: 0,
            commission: 0,
            totalWithCompanyTariffAndCommission: 0,
          },
        },
        three: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
        five: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
        seven: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
      },
    };
  }

  // Find the first vehicle with pricing data to get service levels
  const firstVehicleWithPricing = vehicles.find((vehicle) => vehicle.pricing);
  if (!firstVehicleWithPricing) {
    // If no vehicle has pricing, return empty totals
    return {
      totals: {
        one: {
          open: { total: 0, companyTariff: 0 },
          enclosed: { total: 0, companyTariff: 0 },
        },
        three: {
          open: { total: 0, companyTariff: 0 },
          enclosed: { total: 0, companyTariff: 0 },
        },
        five: {
          open: { total: 0, companyTariff: 0 },
          enclosed: { total: 0, companyTariff: 0 },
        },
        seven: {
          open: { total: 0, companyTariff: 0 },
          enclosed: { total: 0, companyTariff: 0 },
        },
      },
      whiteGlove: { total: 0, companyTariff: 0 },
      modifiers: { total: 0 },
    };
  }

  const serviceLevels =
    (firstVehicleWithPricing as any).pricing.modifiers?.serviceLevels || [];

  for (const vehicle of vehicles) {
    const { pricing } = vehicle as any;

    if (!pricing) {
      continue; // Skip vehicles without pricing data
    }

    baseTms += pricing.base || 0;
    baseWhiteGlove += pricing.totals?.whiteGlove || 0;
    baseCustom += pricing.base || 0;
    conditionalEnclosedFlat += pricing.modifiers?.enclosedFlat || 0;
    conditionalEnclosedPercent += pricing.modifiers?.enclosedPercent || 0;

    totalModifiers += pricing.modifiers?.inoperable || 0;
    totalModifiers += pricing.modifiers?.routes || 0;
    totalModifiers += pricing.modifiers?.states || 0;
    totalModifiers += pricing.modifiers?.vehicles || 0;
    totalModifiers += pricing.modifiers?.globalDiscount || 0;
    totalModifiers += pricing.modifiers?.portalDiscount || 0;
    totalModifiers += pricing.modifiers?.irr || 0;
    totalModifiers += pricing.modifiers?.fuel || 0;
    totalModifiers += pricing.modifiers?.enclosedFlat || 0;
    totalModifiers += pricing.modifiers?.enclosedPercent || 0;

    withoutServiceLevel.open += pricing.totals?.one?.open?.total || 0;
    withoutServiceLevel.enclosed += pricing.totals?.one?.enclosed?.total || 0;

    globalInop += pricing.modifiers?.inoperable || 0;
    globalDiscount += pricing.modifiers?.globalDiscount || 0;
    globalRoutes += pricing.modifiers?.routes || 0;
    globalStates += pricing.modifiers?.states || 0;
    globalVehicles += pricing.modifiers?.vehicles || 0;
    globalOversize += pricing.modifiers?.oversize || 0;
    portalCommission += pricing.modifiers?.commission || 0;
    portalCompanyTariff += pricing.modifiers?.companyTariffs?.[0]?.value || 0;
    portalDiscount += pricing.modifiers?.portalDiscount || 0;
  }

  const conditionalServiceLevels = serviceLevels.map((level: any) => {
    return {
      serviceLevelOption: level.serviceLevelOption,
      value: level.value * vehicles.length,
    };
  });

  // Aggregate totals from all vehicles
  let aggregatedTotals = {
    whiteGlove: 0,
    one: {
      open: {
        total: 0,
        companyTariff: 0,
        commission: 0,
        totalWithCompanyTariffAndCommission: 0,
      },
      enclosed: {
        total: 0,
        companyTariff: 0,
        commission: 0,
        totalWithCompanyTariffAndCommission: 0,
      },
    },
    three: {
      total: 0,
      companyTariff: 0,
      commission: 0,
      totalWithCompanyTariffAndCommission: 0,
    },
    five: {
      total: 0,
      companyTariff: 0,
      commission: 0,
      totalWithCompanyTariffAndCommission: 0,
    },
    seven: {
      total: 0,
      companyTariff: 0,
      commission: 0,
      totalWithCompanyTariffAndCommission: 0,
    },
  };

  // Aggregate totals from each vehicle
  for (const vehicle of vehicles) {
    const { pricing } = vehicle as any;
    if (pricing?.totals) {
      // Aggregate whiteGlove
      aggregatedTotals.whiteGlove += pricing.totals.whiteGlove || 0;

      // Aggregate one.open
      aggregatedTotals.one.open.total += pricing.totals.one?.open?.total || 0;
      aggregatedTotals.one.open.companyTariff +=
        pricing.totals.one?.open?.companyTariff || 0;
      aggregatedTotals.one.open.commission +=
        pricing.totals.one?.open?.commission || 0;
      aggregatedTotals.one.open.totalWithCompanyTariffAndCommission +=
        pricing.totals.one?.open?.totalWithCompanyTariffAndCommission || 0;

      // Aggregate one.enclosed
      aggregatedTotals.one.enclosed.total +=
        pricing.totals.one?.enclosed?.total || 0;
      aggregatedTotals.one.enclosed.companyTariff +=
        pricing.totals.one?.enclosed?.companyTariff || 0;
      aggregatedTotals.one.enclosed.commission +=
        pricing.totals.one?.enclosed?.commission || 0;
      aggregatedTotals.one.enclosed.totalWithCompanyTariffAndCommission +=
        pricing.totals.one?.enclosed?.totalWithCompanyTariffAndCommission || 0;

      // Aggregate three
      aggregatedTotals.three.total += pricing.totals.three?.total || 0;
      aggregatedTotals.three.companyTariff +=
        pricing.totals.three?.companyTariff || 0;
      aggregatedTotals.three.commission +=
        pricing.totals.three?.commission || 0;
      aggregatedTotals.three.totalWithCompanyTariffAndCommission +=
        pricing.totals.three?.totalWithCompanyTariffAndCommission || 0;

      // Aggregate five
      aggregatedTotals.five.total += pricing.totals.five?.total || 0;
      aggregatedTotals.five.companyTariff +=
        pricing.totals.five?.companyTariff || 0;
      aggregatedTotals.five.commission += pricing.totals.five?.commission || 0;
      aggregatedTotals.five.totalWithCompanyTariffAndCommission +=
        pricing.totals.five?.totalWithCompanyTariffAndCommission || 0;

      // Aggregate seven
      aggregatedTotals.seven.total += pricing.totals.seven?.total || 0;
      aggregatedTotals.seven.companyTariff +=
        pricing.totals.seven?.companyTariff || 0;
      aggregatedTotals.seven.commission +=
        pricing.totals.seven?.commission || 0;
      aggregatedTotals.seven.totalWithCompanyTariffAndCommission +=
        pricing.totals.seven?.totalWithCompanyTariffAndCommission || 0;
    }
  }

  let totalPricing: any = {
    base: baseTms,
    modifiers: {
      inoperable: globalInop,
      oversize: globalOversize,
      globalDiscount: globalDiscount,
      routes: globalRoutes,
      states: globalStates,
      vehicles: globalVehicles,
      portalDiscount: portalDiscount,
      commission: portalCommission,
      companyTariffs:
        (firstVehicleWithPricing as any)?.pricing?.modifiers?.companyTariffs ||
        [],
      irr: 0,
      fuel: 0,
      enclosedFlat: conditionalEnclosedFlat,
      enclosedPercent: conditionalEnclosedPercent,
      serviceLevels: conditionalServiceLevels,
    },
    totals: aggregatedTotals,
  };

  return totalPricing;
};
