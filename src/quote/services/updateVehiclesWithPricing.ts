import { IVehicle } from "../../_global/interfaces";
import { ModifierSet } from "../../modifierSet/schema";
import { getTMSBaseRate } from "../integrations/getTMSBaseRate";
import { getCustomBaseRate } from "../integrations/getCustomBaseRate";
import { ServiceLevelOption, VehicleClass } from "../../_global/enums";
import { IPortal } from "../../portal/schema";
import { roundCurrency } from "../../_global/utils/roundCurrency";

interface VehiclePriceParams {
  portal: IPortal;
  vehicle: Partial<IVehicle>;
  miles: number;
  origin: string;
  originState: string;
  destination: string;
  destinationState: string;
  commission: number;
}

const calculateModifier = (
  modifier: { valueType: string; value: number },
  base: number,
): number => {
  if (modifier.valueType === "percentage") {
    return Math.ceil(base * (modifier.value / 100));
  }
  return modifier.value;
};

const getVehiclePrice = async (params: VehiclePriceParams): Promise<any> => {
  const {
    vehicle,
    miles,
    origin,
    originState,
    destination,
    destinationState,
    portal,
    commission,
  } = params;

  // Get Autovista-wide modifiers
  const globalModifiers = await ModifierSet.findOne({ isGlobal: true });

  // Get portal-specific modifiers
  const portalModifiers = await ModifierSet.findOne({ portalId: portal._id });

  if (!globalModifiers || !portalModifiers) {
    return null;
  }

  // Get vehicle base rate from Super Dispatch or portal's custom rates

  const baseTms = await getTMSBaseRate(vehicle, origin, destination);
  const baseCustom = getCustomBaseRate(miles, portal);

  const whiteGloveMultiplier = portalModifiers.whiteGlove
    ? portalModifiers.whiteGlove.multiplier
    : globalModifiers.whiteGlove?.multiplier || 2;

  let baseWhiteGlove = miles * whiteGloveMultiplier;

  if (baseWhiteGlove < globalModifiers.whiteGlove.minimum) {
    baseWhiteGlove = globalModifiers.whiteGlove.minimum;
  }

  let calculatedCommission = commission;
  let calculatedGlobalDiscount: number = 0;
  let calculatedTariff: number = 0;
  let calculatedPortalDiscount: number = 0;
  let calculatedInoperable: number = 0;
  let calculatedGlobalOversize: number = 0;
  let calculatedRoutes: number = 0;
  let calculatedEnclosed: number = 0;

  const baseForModifiers = portal.options?.enableCustomRates
    ? baseCustom
    : baseTms;

  if (globalModifiers.discount) {
    calculatedGlobalDiscount = calculateModifier(
      globalModifiers.discount,
      baseForModifiers,
    );
  }

  if (portalModifiers.fixedCommission) {
    calculatedCommission = calculateModifier(
      portalModifiers.fixedCommission,
      baseForModifiers,
    );
  }

  if (portalModifiers.companyTariff) {
    calculatedTariff = calculateModifier(
      portalModifiers.companyTariff,
      baseForModifiers,
    );
  }

  if (portalModifiers.discount) {
    calculatedPortalDiscount = calculateModifier(
      portalModifiers.discount,
      baseForModifiers,
    );
  }

  if (globalModifiers.oversize) {
    switch (vehicle.class) {
      case VehicleClass.SUV:
        calculatedGlobalOversize = calculateModifier(
          { value: globalModifiers.oversize.suv, valueType: "flat" },
          baseForModifiers,
        );
        break;
      case VehicleClass.Van:
        calculatedGlobalOversize = calculateModifier(
          { value: globalModifiers.oversize.van, valueType: "flat" },
          baseForModifiers,
        );
        break;
      case VehicleClass.Pickup2Door:
        calculatedGlobalOversize = calculateModifier(
          { value: globalModifiers.oversize.pickup_2_door, valueType: "flat" },
          baseForModifiers,
        );
        break;
      case VehicleClass.Pickup4Door:
        calculatedGlobalOversize = calculateModifier(
          { value: globalModifiers.oversize.pickup_4_door, valueType: "flat" },
          baseForModifiers,
        );
        break;
      default:
        break;
    }
  }

  if (vehicle.isInoperable && globalModifiers.inoperable) {
    calculatedInoperable = calculateModifier(
      globalModifiers.inoperable,
      baseForModifiers,
    );
  }

  if (globalModifiers.enclosed) {
    calculatedEnclosed = calculateModifier(
      globalModifiers.enclosed,
      baseForModifiers,
    );
  }

  if (globalModifiers.routes) {
    if (Array.isArray(globalModifiers.routes)) {
      const matchingRoutes = globalModifiers.routes.filter(
        (route) =>
          (route.origin === originState && !route.destination) ||
          (!route.origin && route.destination === destinationState) ||
          (route.origin === originState &&
            route.destination === destinationState),
      );

      matchingRoutes.forEach((route) => {
        let calculatedValue = calculateModifier(route, baseForModifiers);
        calculatedRoutes += calculatedValue;
      });
    }
  }

  const calculatedModifiers =
    calculatedInoperable +
    calculatedGlobalDiscount +
    calculatedRoutes +
    calculatedCommission +
    calculatedTariff +
    calculatedPortalDiscount +
    calculatedGlobalOversize;

  const calculatedTotal = baseForModifiers + calculatedModifiers;

  return {
    base: {
      tms: baseTms,
      whiteGlove: roundCurrency(baseWhiteGlove),
      custom: baseCustom,
    },
    modifiers: {
      global: {
        inoperable: calculatedInoperable,
        discount: calculatedGlobalDiscount,
        routes: calculatedRoutes,
        oversize: calculatedGlobalOversize,
      },
      portal: {
        commission: calculatedCommission,
        companyTariff: calculatedTariff,
        discount: calculatedPortalDiscount,
      },
      conditional: {
        enclosed: calculatedEnclosed,
        serviceLevels: globalModifiers.serviceLevels,
      },
    },
    totalModifiers: roundCurrency(calculatedModifiers),
    total: {
      withoutServiceLevel: roundCurrency(calculatedTotal),
      serviceLevels: [
        {
          serviceLevelOption: ServiceLevelOption.OneDay,
          enclosed:
            calculatedTotal +
            globalModifiers.serviceLevels[0].value +
            calculatedEnclosed,
          open: calculatedTotal + globalModifiers.serviceLevels[0].value,
        },
        {
          serviceLevelOption: ServiceLevelOption.ThreeDay,
          enclosed:
            calculatedTotal +
            globalModifiers.serviceLevels[1].value +
            calculatedEnclosed,
          open: calculatedTotal + globalModifiers.serviceLevels[1].value,
        },
        {
          serviceLevelOption: ServiceLevelOption.FiveDay,
          enclosed:
            calculatedTotal +
            globalModifiers.serviceLevels[2].value +
            calculatedEnclosed,
          open: calculatedTotal + globalModifiers.serviceLevels[2].value,
        },
        {
          serviceLevelOption: ServiceLevelOption.SevenDay,
          enclosed:
            calculatedTotal +
            globalModifiers.serviceLevels[3].value +
            calculatedEnclosed,
          open: calculatedTotal + globalModifiers.serviceLevels[3].value,
        },
      ],
    },
  };
};

export const updateVehiclesWithPricing = async ({
  portal,
  vehicles,
  miles,
  origin,
  originState,
  destination,
  destinationState,
  commission,
}: {
  portal: IPortal;
  vehicles: Array<Partial<IVehicle>>;
  miles: number;
  origin: string;
  originState: string;
  destination: string;
  destinationState: string;
  commission: number;
}): Promise<IVehicle[]> => {
  const updatedVehicles: IVehicle[] = [];

  for (const vehicle of vehicles) {
    const pricing = await getVehiclePrice({
      vehicle,
      miles,
      origin,
      originState,
      destination,
      destinationState,
      portal,
      commission,
    });

    updatedVehicles.push({
      ...vehicle,
      pricing,
    } as IVehicle);
  }

  return updatedVehicles;
};
