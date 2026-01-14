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
      // Legacy fallback
      total: 0,
      companyTariff: 0,
      commission: 0,
      totalWithCompanyTariffAndCommission: 0,
    },
    five: {
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
      // Legacy fallback
      total: 0,
      companyTariff: 0,
      commission: 0,
      totalWithCompanyTariffAndCommission: 0,
    },
    seven: {
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
      // Legacy fallback
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

      // Aggregate three.open
      aggregatedTotals.three.open.total += pricing.totals.three?.open?.total || pricing.totals.three?.total || 0;
      aggregatedTotals.three.open.companyTariff += pricing.totals.three?.open?.companyTariff || pricing.totals.three?.companyTariff || 0;
      aggregatedTotals.three.open.commission += pricing.totals.three?.open?.commission || pricing.totals.three?.commission || 0;
      aggregatedTotals.three.open.totalWithCompanyTariffAndCommission += pricing.totals.three?.open?.totalWithCompanyTariffAndCommission || pricing.totals.three?.totalWithCompanyTariffAndCommission || 0;

      // Aggregate three.enclosed
      aggregatedTotals.three.enclosed.total += pricing.totals.three?.enclosed?.total || pricing.totals.three?.total || 0;
      aggregatedTotals.three.enclosed.companyTariff += pricing.totals.three?.enclosed?.companyTariff || pricing.totals.three?.companyTariff || 0;
      aggregatedTotals.three.enclosed.commission += pricing.totals.three?.enclosed?.commission || pricing.totals.three?.commission || 0;
      aggregatedTotals.three.enclosed.totalWithCompanyTariffAndCommission += pricing.totals.three?.enclosed?.totalWithCompanyTariffAndCommission || pricing.totals.three?.totalWithCompanyTariffAndCommission || 0;

      // Legacy fallback for three
      aggregatedTotals.three.total += pricing.totals.three?.open?.total || pricing.totals.three?.total || 0;
      aggregatedTotals.three.companyTariff += pricing.totals.three?.open?.companyTariff || pricing.totals.three?.companyTariff || 0;
      aggregatedTotals.three.commission += pricing.totals.three?.open?.commission || pricing.totals.three?.commission || 0;
      aggregatedTotals.three.totalWithCompanyTariffAndCommission += pricing.totals.three?.open?.totalWithCompanyTariffAndCommission || pricing.totals.three?.totalWithCompanyTariffAndCommission || 0;

      // Aggregate five.open
      aggregatedTotals.five.open.total += pricing.totals.five?.open?.total || pricing.totals.five?.total || 0;
      aggregatedTotals.five.open.companyTariff += pricing.totals.five?.open?.companyTariff || pricing.totals.five?.companyTariff || 0;
      aggregatedTotals.five.open.commission += pricing.totals.five?.open?.commission || pricing.totals.five?.commission || 0;
      aggregatedTotals.five.open.totalWithCompanyTariffAndCommission += pricing.totals.five?.open?.totalWithCompanyTariffAndCommission || pricing.totals.five?.totalWithCompanyTariffAndCommission || 0;

      // Aggregate five.enclosed
      aggregatedTotals.five.enclosed.total += pricing.totals.five?.enclosed?.total || pricing.totals.five?.total || 0;
      aggregatedTotals.five.enclosed.companyTariff += pricing.totals.five?.enclosed?.companyTariff || pricing.totals.five?.companyTariff || 0;
      aggregatedTotals.five.enclosed.commission += pricing.totals.five?.enclosed?.commission || pricing.totals.five?.commission || 0;
      aggregatedTotals.five.enclosed.totalWithCompanyTariffAndCommission += pricing.totals.five?.enclosed?.totalWithCompanyTariffAndCommission || pricing.totals.five?.totalWithCompanyTariffAndCommission || 0;

      // Legacy fallback for five
      aggregatedTotals.five.total += pricing.totals.five?.open?.total || pricing.totals.five?.total || 0;
      aggregatedTotals.five.companyTariff += pricing.totals.five?.open?.companyTariff || pricing.totals.five?.companyTariff || 0;
      aggregatedTotals.five.commission += pricing.totals.five?.open?.commission || pricing.totals.five?.commission || 0;
      aggregatedTotals.five.totalWithCompanyTariffAndCommission += pricing.totals.five?.open?.totalWithCompanyTariffAndCommission || pricing.totals.five?.totalWithCompanyTariffAndCommission || 0;

      // Aggregate seven.open
      aggregatedTotals.seven.open.total += pricing.totals.seven?.open?.total || pricing.totals.seven?.total || 0;
      aggregatedTotals.seven.open.companyTariff += pricing.totals.seven?.open?.companyTariff || pricing.totals.seven?.companyTariff || 0;
      aggregatedTotals.seven.open.commission += pricing.totals.seven?.open?.commission || pricing.totals.seven?.commission || 0;
      aggregatedTotals.seven.open.totalWithCompanyTariffAndCommission += pricing.totals.seven?.open?.totalWithCompanyTariffAndCommission || pricing.totals.seven?.totalWithCompanyTariffAndCommission || 0;

      // Aggregate seven.enclosed
      aggregatedTotals.seven.enclosed.total += pricing.totals.seven?.enclosed?.total || pricing.totals.seven?.total || 0;
      aggregatedTotals.seven.enclosed.companyTariff += pricing.totals.seven?.enclosed?.companyTariff || pricing.totals.seven?.companyTariff || 0;
      aggregatedTotals.seven.enclosed.commission += pricing.totals.seven?.enclosed?.commission || pricing.totals.seven?.commission || 0;
      aggregatedTotals.seven.enclosed.totalWithCompanyTariffAndCommission += pricing.totals.seven?.enclosed?.totalWithCompanyTariffAndCommission || pricing.totals.seven?.totalWithCompanyTariffAndCommission || 0;

      // Legacy fallback for seven
      aggregatedTotals.seven.total += pricing.totals.seven?.open?.total || pricing.totals.seven?.total || 0;
      aggregatedTotals.seven.companyTariff += pricing.totals.seven?.open?.companyTariff || pricing.totals.seven?.companyTariff || 0;
      aggregatedTotals.seven.commission += pricing.totals.seven?.open?.commission || pricing.totals.seven?.commission || 0;
      aggregatedTotals.seven.totalWithCompanyTariffAndCommission += pricing.totals.seven?.open?.totalWithCompanyTariffAndCommission || pricing.totals.seven?.totalWithCompanyTariffAndCommission || 0;
    }
  }

  // Round all aggregated totals to match updateVehiclesWithPricing format
  const roundedTotals = {
    whiteGlove: roundCurrency(aggregatedTotals.whiteGlove),
    one: {
      open: {
        total: roundCurrency(aggregatedTotals.one.open.total),
        companyTariff: roundCurrency(aggregatedTotals.one.open.companyTariff),
        commission: roundCurrency(aggregatedTotals.one.open.commission),
        totalWithCompanyTariffAndCommission: roundCurrency(aggregatedTotals.one.open.totalWithCompanyTariffAndCommission),
      },
      enclosed: {
        total: roundCurrency(aggregatedTotals.one.enclosed.total),
        companyTariff: roundCurrency(aggregatedTotals.one.enclosed.companyTariff),
        commission: roundCurrency(aggregatedTotals.one.enclosed.commission),
        totalWithCompanyTariffAndCommission: roundCurrency(aggregatedTotals.one.enclosed.totalWithCompanyTariffAndCommission),
      },
    },
    three: {
      open: {
        total: roundCurrency(aggregatedTotals.three.open.total),
        companyTariff: roundCurrency(aggregatedTotals.three.open.companyTariff),
        commission: roundCurrency(aggregatedTotals.three.open.commission),
        totalWithCompanyTariffAndCommission: roundCurrency(aggregatedTotals.three.open.totalWithCompanyTariffAndCommission),
      },
      enclosed: {
        total: roundCurrency(aggregatedTotals.three.enclosed.total),
        companyTariff: roundCurrency(aggregatedTotals.three.enclosed.companyTariff),
        commission: roundCurrency(aggregatedTotals.three.enclosed.commission),
        totalWithCompanyTariffAndCommission: roundCurrency(aggregatedTotals.three.enclosed.totalWithCompanyTariffAndCommission),
      },
      // Legacy fallback
      total: roundCurrency(aggregatedTotals.three.total),
      companyTariff: roundCurrency(aggregatedTotals.three.companyTariff),
      commission: roundCurrency(aggregatedTotals.three.commission),
      totalWithCompanyTariffAndCommission: roundCurrency(aggregatedTotals.three.totalWithCompanyTariffAndCommission),
    },
    five: {
      open: {
        total: roundCurrency(aggregatedTotals.five.open.total),
        companyTariff: roundCurrency(aggregatedTotals.five.open.companyTariff),
        commission: roundCurrency(aggregatedTotals.five.open.commission),
        totalWithCompanyTariffAndCommission: roundCurrency(aggregatedTotals.five.open.totalWithCompanyTariffAndCommission),
      },
      enclosed: {
        total: roundCurrency(aggregatedTotals.five.enclosed.total),
        companyTariff: roundCurrency(aggregatedTotals.five.enclosed.companyTariff),
        commission: roundCurrency(aggregatedTotals.five.enclosed.commission),
        totalWithCompanyTariffAndCommission: roundCurrency(aggregatedTotals.five.enclosed.totalWithCompanyTariffAndCommission),
      },
      // Legacy fallback
      total: roundCurrency(aggregatedTotals.five.total),
      companyTariff: roundCurrency(aggregatedTotals.five.companyTariff),
      commission: roundCurrency(aggregatedTotals.five.commission),
      totalWithCompanyTariffAndCommission: roundCurrency(aggregatedTotals.five.totalWithCompanyTariffAndCommission),
    },
    seven: {
      open: {
        total: roundCurrency(aggregatedTotals.seven.open.total),
        companyTariff: roundCurrency(aggregatedTotals.seven.open.companyTariff),
        commission: roundCurrency(aggregatedTotals.seven.open.commission),
        totalWithCompanyTariffAndCommission: roundCurrency(aggregatedTotals.seven.open.totalWithCompanyTariffAndCommission),
      },
      enclosed: {
        total: roundCurrency(aggregatedTotals.seven.enclosed.total),
        companyTariff: roundCurrency(aggregatedTotals.seven.enclosed.companyTariff),
        commission: roundCurrency(aggregatedTotals.seven.enclosed.commission),
        totalWithCompanyTariffAndCommission: roundCurrency(aggregatedTotals.seven.enclosed.totalWithCompanyTariffAndCommission),
      },
      // Legacy fallback
      total: roundCurrency(aggregatedTotals.seven.total),
      companyTariff: roundCurrency(aggregatedTotals.seven.companyTariff),
      commission: roundCurrency(aggregatedTotals.seven.commission),
      totalWithCompanyTariffAndCommission: roundCurrency(aggregatedTotals.seven.totalWithCompanyTariffAndCommission),
    },
  };

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
    totals: roundedTotals,
  };

  return totalPricing;
};
