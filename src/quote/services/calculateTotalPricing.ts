import { IVehicle, IPricing } from "../../_global/interfaces";

export const calculateTotalPricing = async (
  vehicles: IVehicle[],
): Promise<IPricing> => {
  let base = 0;
  let baseWhiteGlove = 0;
  let total = 0;
  let conditionalEnclosed = 0;
  let totalModifiers = 0;
  let totalWhiteGlove = 0;
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

  const serviceLevels = vehicles[0].pricing.conditionalModifiers.serviceLevels;

  for (const vehicle of vehicles) {
    const { pricing } = vehicle;

    if (!pricing) {
      throw new Error();
    }

    base += pricing.base || 0;
    baseWhiteGlove += pricing.baseWhiteGlove || 0;
    total += pricing.total || 0;
    totalModifiers += pricing.totalModifiers || 0;
    totalWhiteGlove += pricing.totalWhiteGlove || 0;
    conditionalEnclosed += pricing.conditionalModifiers.enclosed || 0;
    globalInop += pricing.globalModifiers?.inoperable || 0;
    globalDiscount += pricing.globalModifiers?.discount || 0;
    globalRoutes += pricing.globalModifiers?.routes || 0;
    globalOversize += pricing.globalModifiers?.oversize || 0;
    portalCommission += pricing.portalModifiers?.commission || 0;
    portalCompanyTariff += pricing.portalModifiers?.companyTariff || 0;
    portalDiscount += pricing.portalModifiers?.discount || 0;
  }

  const conditionalServiceLevels = serviceLevels.map((level) => {
    return {
      serviceLevelOption: level.serviceLevelOption,
      value: level.value * vehicles.length,
    };
  });

  let totalPricing: IPricing = {
    base,
    baseWhiteGlove,
    globalModifiers: {
      inoperable: globalInop,
      oversize: globalOversize,
      discount: globalDiscount,
      routes: globalRoutes,
    },
    portalModifiers: {
      discount: portalDiscount,
      commission: portalCommission,
      companyTariff: portalCompanyTariff,
    },
    conditionalModifiers: {
      enclosed: conditionalEnclosed,
      serviceLevels: conditionalServiceLevels,
    },
    totalModifiers,
    total,
    totalWhiteGlove,
  };

  return totalPricing;
};
