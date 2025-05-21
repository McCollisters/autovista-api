import { IVehicle } from "../../_global/interfaces";
import { ModifierSet } from "../../modifierSet/schema";
import { getTMSBaseRate } from "../integrations/getTMSBaseRate";
import { getCustomBaseRate } from "../integrations/getCustomBaseRate";
import { VehicleClass } from "../../_global/enums";
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
  const base = portal.options?.enableCustomRates
    ? getCustomBaseRate(miles, portal)
    : await getTMSBaseRate(vehicle, origin, destination);

  let calculatedGlobalDiscount: number = 0;
  let calculatedTariff: number = 0;
  let calculatedPortalDiscount: number = 0;
  let calculatedInoperable: number = 0;
  let calculatedGlobalOversize: number = 0;
  let calculatedRoutes: number = 0;
  let calculatedEnclosed: number = 0;
  let baseWhiteGlove: number = 0;

  if (globalModifiers.discount) {
    calculatedGlobalDiscount = calculateModifier(
      globalModifiers.discount,
      base,
    );
  }

  const whiteGloveMultiplier = portalModifiers.whiteGlove
    ? portalModifiers.whiteGlove.multiplier
    : globalModifiers.whiteGlove?.multiplier || 2;

  if (whiteGloveMultiplier) {
    baseWhiteGlove = miles * whiteGloveMultiplier;
  }

  if (portalModifiers.companyTariff) {
    calculatedTariff = calculateModifier(portalModifiers.companyTariff, base);
  }

  if (portalModifiers.discount) {
    calculatedPortalDiscount = calculateModifier(
      portalModifiers.discount,
      base,
    );
  }

  if (globalModifiers.oversize) {
    switch (vehicle.class) {
      case VehicleClass.SUV:
        calculatedGlobalOversize = calculateModifier(
          { value: globalModifiers.oversize.suv, valueType: "flat" },
          base,
        );
        break;
      case VehicleClass.Van:
        calculatedGlobalOversize = calculateModifier(
          { value: globalModifiers.oversize.van, valueType: "flat" },
          base,
        );
        break;
      case VehicleClass.Pickup2Door:
        calculatedGlobalOversize = calculateModifier(
          { value: globalModifiers.oversize.pickup_2_door, valueType: "flat" },
          base,
        );
        break;
      case VehicleClass.Pickup4Door:
        calculatedGlobalOversize = calculateModifier(
          { value: globalModifiers.oversize.pickup_4_door, valueType: "flat" },
          base,
        );
        break;
      default:
        break;
    }
  }

  if (vehicle.isInoperable && globalModifiers.inoperable) {
    calculatedInoperable = calculateModifier(globalModifiers.inoperable, base);
  }

  if (globalModifiers.enclosed) {
    calculatedEnclosed = calculateModifier(globalModifiers.enclosed, base);
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
        let calculatedValue = calculateModifier(route, base);
        calculatedRoutes += calculatedValue;
      });
    }
  }

  const calculatedModifiers =
    calculatedInoperable +
    calculatedGlobalDiscount +
    calculatedRoutes +
    commission +
    calculatedTariff +
    calculatedPortalDiscount +
    calculatedGlobalOversize;

  const calculatedTotal = base + calculatedModifiers;

  const calculatedWhiteGloveTotal = baseWhiteGlove + calculatedModifiers;

  return {
    base,
    baseWhiteGlove: roundCurrency(baseWhiteGlove),
    globalModifiers: {
      inoperable: calculatedInoperable,
      discount: calculatedGlobalDiscount,
      routes: calculatedRoutes,
      oversize: calculatedGlobalOversize,
    },
    portalModifiers: {
      commission,
      companyTariff: calculatedTariff,
      discount: calculatedPortalDiscount,
    },
    conditionalModifiers: {
      enclosed: calculatedEnclosed,
      serviceLevels: globalModifiers.serviceLevels,
    },
    totalModifiers: roundCurrency(calculatedModifiers),
    // total = base rate + modifiers (excl. conditional)
    total: roundCurrency(calculatedTotal),
    // total = white glove base rate + modifiers (excl. conditional)
    totalWhiteGlove: roundCurrency(calculatedWhiteGloveTotal),
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
