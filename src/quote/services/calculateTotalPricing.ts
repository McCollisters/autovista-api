import { ServiceLevelOption } from "../../_global/enums";
import { IVehicle, IPricing } from "../../_global/interfaces";

export const calculateTotalPricing = async (
  vehicles: IVehicle[],
): Promise<IPricing> => {
  let base = 0;
  let total = 0;
  let totalEnclosed = 0;
  let globalInop = 0;
  let globalDiscount = 0;
  let globalRoutes = 0;
  let globalOversize = 0;
  let portalCommission = 0;
  let portalCompanyTariff = 0;
  let portalDiscount = 0;
  let serviceLevelWhiteGlove = 0;
  let serviceLevel1 = 0;
  let serviceLevel3 = 0;
  let serviceLevel5 = 0;
  let serviceLevel7 = 0;
  let serviceLevel1Enclosed = 0;
  let serviceLevel3Enclosed = 0;
  let serviceLevel5Enclosed = 0;
  let serviceLevel7Enclosed = 0;

  for (const vehicle of vehicles) {
    console.log(vehicle.pricing);

    const { pricing } = vehicle;

    base += pricing?.base || 0;
    total += pricing?.total || 0;
    totalEnclosed += pricing?.totalEnclosed || 0;
    globalInop += pricing?.globalModifiers?.inoperable || 0;
    globalDiscount += pricing?.globalModifiers?.discount || 0;
    globalRoutes += pricing?.globalModifiers?.routes || 0;
    globalOversize += pricing?.globalModifiers?.oversize || 0;
    portalCommission += pricing?.portalModifiers?.commission || 0;
    portalCompanyTariff += pricing?.portalModifiers?.companyTariff || 0;
    portalDiscount += pricing?.portalModifiers?.discount || 0;

    serviceLevelWhiteGlove += pricing?.totalsByServiceLevel[0].total || 0;
    serviceLevel1 += pricing?.totalsByServiceLevel[1].total || 0;
    serviceLevel3 += pricing?.totalsByServiceLevel[2].total || 0;
    serviceLevel5 += pricing?.totalsByServiceLevel[3].total || 0;
    serviceLevel7 += pricing?.totalsByServiceLevel[4].total || 0;

    serviceLevel1Enclosed +=
      pricing?.totalsByServiceLevel[1].totalEnclosed || 0;
    serviceLevel3 += pricing?.totalsByServiceLevel[2].totalEnclosed || 0;
    serviceLevel5 += pricing?.totalsByServiceLevel[3].totalEnclosed || 0;
    serviceLevel7 += pricing?.totalsByServiceLevel[4].totalEnclosed || 0;
  }

  let totalPricing: IPricing = {
    base,
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
    total,
    totalEnclosed,
    totalsByServiceLevel: [
      {
        serviceLevelOption: ServiceLevelOption.WhiteGlove,
        total: serviceLevelWhiteGlove,
      },
      {
        serviceLevelOption: ServiceLevelOption.OneDay,
        total: serviceLevel1,
        totalEnclosed: serviceLevel1Enclosed,
      },
      {
        serviceLevelOption: ServiceLevelOption.ThreeDay,
        total: serviceLevel3,
        totalEnclosed: serviceLevel3Enclosed,
      },
      {
        serviceLevelOption: ServiceLevelOption.ThreeDay,
        total: serviceLevel5,
        totalEnclosed: serviceLevel5Enclosed,
      },
      {
        serviceLevelOption: ServiceLevelOption.ThreeDay,
        total: serviceLevel7,
        totalEnclosed: serviceLevel7Enclosed,
      },
    ],
  };

  return totalPricing;
};
