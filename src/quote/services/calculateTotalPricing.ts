import { ServiceLevelOption } from "../../_global/enums";
import { IVehicle, IPricingQuote } from "../../_global/interfaces";
import { IPortal } from "../../portal/schema";
import { roundCurrency } from "../../_global/utils/roundCurrency";

export const calculateTotalPricing = async (
  vehicles: IVehicle[],
  portal: IPortal,
): Promise<IPricingQuote> => {
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

  if (!vehicles[0] || !vehicles[0].pricing) {
    throw new Error();
  }

  const serviceLevels = vehicles[0].pricing.modifiers.conditional.serviceLevels;

  for (const vehicle of vehicles) {
    const { pricing } = vehicle;

    if (!pricing) {
      throw new Error();
    }

    baseTms += pricing.base.tms || 0;
    baseWhiteGlove += pricing.base.whiteGlove || 0;
    baseCustom += pricing.base.custom || 0;
    conditionalEnclosedFlat += pricing.modifiers.conditional.enclosedFlat || 0;
    conditionalEnclosedPercent +=
      pricing.modifiers.conditional.enclosedPercent || 0;

    totalModifiers += pricing.totalModifiers || 0;
    withoutServiceLevel.open += pricing.total.withoutServiceLevel.open || 0;
    withoutServiceLevel.enclosed +=
      pricing.total.withoutServiceLevel.enclosed || 0;

    globalInop += pricing.modifiers.global.inoperable || 0;
    globalDiscount += pricing.modifiers.global.discount || 0;
    globalRoutes += pricing.modifiers.global.routes || 0;
    globalStates += pricing.modifiers.global.states || 0;
    globalVehicles += pricing.modifiers.global.vehicles || 0;
    globalOversize += pricing.modifiers.global.oversize || 0;
    portalCommission += pricing.modifiers.portal.commission || 0;
    portalCompanyTariff += pricing.modifiers.portal.companyTariff || 0;
    portalDiscount += pricing.modifiers.portal.discount || 0;
  }

  const conditionalServiceLevels = serviceLevels.map((level) => {
    return {
      serviceLevelOption: level.serviceLevelOption,
      value: level.value * vehicles.length,
    };
  });

  const baseForModifiers = portal.options?.enableCustomRates
    ? baseCustom
    : baseTms;

  let totalPricing: IPricingQuote = {
    base: {
      tms: baseTms,
      whiteGlove: roundCurrency(baseWhiteGlove),
      custom: baseCustom,
    },
    modifiers: {
      global: {
        inoperable: globalInop,
        oversize: globalOversize,
        discount: globalDiscount,
        routes: globalRoutes,
        states: globalStates,
        vehicles: globalVehicles,
      },
      portal: {
        discount: portalDiscount,
        commission: portalCommission,
        companyTariff: portalCompanyTariff,
      },
      conditional: {
        enclosedFlat: conditionalEnclosedFlat,
        enclosedPercent: conditionalEnclosedPercent,
        serviceLevels: conditionalServiceLevels,
      },
    },
    total: {
      whiteGlove: {
        enclosedTms: roundCurrency(baseWhiteGlove),
        enclosed: roundCurrency(
          baseWhiteGlove + portalCommission + portalCompanyTariff,
        ),
      },
      withoutServiceLevel: {
        open: roundCurrency(
          baseForModifiers +
            globalInop +
            globalDiscount +
            globalRoutes +
            globalStates +
            globalVehicles +
            portalCommission +
            portalCompanyTariff +
            portalDiscount +
            globalOversize,
        ),
        openTms: roundCurrency(
          baseForModifiers +
            globalInop +
            globalDiscount +
            globalRoutes +
            globalStates +
            globalVehicles +
            portalDiscount +
            globalOversize,
        ),
        enclosed: roundCurrency(
          baseForModifiers +
            globalInop +
            globalDiscount +
            globalRoutes +
            globalStates +
            globalVehicles +
            portalCommission +
            portalCompanyTariff +
            portalDiscount +
            globalOversize +
            conditionalEnclosedFlat +
            conditionalEnclosedPercent,
        ),
        enclosedTms: roundCurrency(
          baseForModifiers +
            globalInop +
            globalDiscount +
            globalRoutes +
            globalStates +
            globalVehicles +
            portalDiscount +
            globalOversize +
            conditionalEnclosedFlat +
            conditionalEnclosedPercent,
        ),
      },
    },
  };

  return totalPricing;
};
