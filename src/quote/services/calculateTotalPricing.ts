import { ServiceLevelOption } from "../../_global/enums";
import { IVehicle, IPricingQuote } from "../../_global/interfaces";
import { roundCurrency } from "../../_global/utils/roundCurrency";

export const calculateTotalPricing = async (
  vehicles: IVehicle[],
): Promise<IPricingQuote> => {
  let baseTms = 0;
  let baseWhiteGlove = 0;
  let baseCustom = 0;

  let conditionalEnclosed = 0;
  let totalModifiers = 0;
  let withoutServiceLevel = 0;
  let globalInop = 0;
  let globalDiscount = 0;
  let globalRoutes = 0;
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

    conditionalEnclosed += pricing.modifiers.conditional.enclosed || 0;

    totalModifiers += pricing.totalModifiers || 0;
    withoutServiceLevel += pricing.total.withoutServiceLevel || 0;

    globalInop += pricing.modifiers.global.inoperable || 0;
    globalDiscount += pricing.modifiers.global.discount || 0;
    globalRoutes += pricing.modifiers.global.routes || 0;
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

  console.log(conditionalServiceLevels);
  console.log(vehicles.length);
  console.log(conditionalEnclosed);

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
      },
      portal: {
        discount: portalDiscount,
        commission: portalCommission,
        companyTariff: portalCompanyTariff,
      },
      conditional: {
        enclosed: conditionalEnclosed,
        serviceLevels: conditionalServiceLevels,
      },
    },
    totalModifiers,
    total: {
      withoutServiceLevel,
      serviceLevels: [
        {
          serviceLevelOption: ServiceLevelOption.OneDay,
          enclosed:
            withoutServiceLevel +
            conditionalServiceLevels[0].value +
            conditionalEnclosed,
          open: withoutServiceLevel + conditionalServiceLevels[0].value,
        },
        {
          serviceLevelOption: ServiceLevelOption.ThreeDay,
          enclosed:
            withoutServiceLevel +
            conditionalServiceLevels[1].value +
            conditionalEnclosed,
          open: withoutServiceLevel + conditionalServiceLevels[1].value,
        },
        {
          serviceLevelOption: ServiceLevelOption.FiveDay,
          enclosed:
            withoutServiceLevel +
            conditionalServiceLevels[2].value +
            conditionalEnclosed,
          open: withoutServiceLevel + conditionalServiceLevels[2].value,
        },
        {
          serviceLevelOption: ServiceLevelOption.SevenDay,
          enclosed:
            withoutServiceLevel +
            conditionalServiceLevels[3].value +
            conditionalEnclosed,
          open: withoutServiceLevel + conditionalServiceLevels[3].value,
        },
      ],
    },
  };

  return totalPricing;
};
