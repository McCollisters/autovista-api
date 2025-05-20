import { ServiceLevelOption } from "../../_global/enums";
import { IVehicle, IPricing } from "../../_global/interfaces";

export const calculateTotalPricing = async (
  vehicles: IVehicle[],
): Promise<IPricing> => {
  let totalPricing: IPricing = {
    base: 0,
    globalModifiers: {
      total: 100,
      inoperable: 50,
      oversize: 0,
      serviceLevels: [
        {
          serviceLevelOption: ServiceLevelOption.OneDay,
          value: 150,
        },
        {
          serviceLevelOption: ServiceLevelOption.ThreeDay,
          value: 125,
        },
        {
          serviceLevelOption: ServiceLevelOption.ThreeDay,
          value: 100,
        },
        {
          serviceLevelOption: ServiceLevelOption.ThreeDay,
          value: 75,
        },
      ],
    },
    portalModifiers: {
      discount: 0,
      total: 100,
      commission: 50,
      companyTariff: 50,
    },
    total: 1000,
    totalsByServiceLevel: [
      {
        serviceLevelOption: ServiceLevelOption.WhiteGlove,
        total: 1000,
      },
      {
        serviceLevelOption: ServiceLevelOption.OneDay,
        total: 1000,
      },
      {
        serviceLevelOption: ServiceLevelOption.ThreeDay,
        total: 1000,
      },
      {
        serviceLevelOption: ServiceLevelOption.FiveDay,
        total: 1000,
      },
      {
        serviceLevelOption: ServiceLevelOption.SevenDay,
        total: 1000,
      },
    ],
  };

  // for (const vehicle of vehicles) {
  //     const pricing = await getVehiclePricing(vehicle);

  //     totalPricing.base += pricing.base;
  //     totalPricing.globalMarkups.inoperable += pricing.globalMarkups.inoperable;
  //     totalPricing.globalMarkups.oversize += pricing.globalMarkups.oversize;
  //     totalPricing.portalMarkups.commission += pricing.portalMarkups.commission;
  //     totalPricing.portalMarkups.companyTariff += pricing.portalMarkups.companyTariff;
  // }

  return totalPricing;
};
