import { IVehicle } from "../../_global/interfaces";
import { ModifierSet } from "../../modifierSet/schema";
import { getTMSBaseRate } from "../integrations/getTMSBaseRate";
import { getCustomBaseRate } from "../integrations/getCustomBaseRate";
import { VehicleClass } from "../../_global/enums";
import { IPortal } from "../../portal/schema";

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

  const globalModifiers = await ModifierSet.findOne({ isGlobal: true });
  const portalModifiers = await ModifierSet.findOne({ portalId: portal._id });

  if (!globalModifiers || !portalModifiers) {
    return null;
  }

  const base = portal.options?.enableCustomRates
    ? getCustomBaseRate(miles, portal)
    : await getTMSBaseRate(vehicle, origin, destination);

  let calculatedGlobalDiscount: number = 0;
  let calculatedTariff: number = 0;
  let calculatedPortalDiscount: number = 0;
  let calculatedInoperable: number = 0;
  let calculatedPortalOversize: number = 0;
  let calculatedRoutes: number = 0;

  if (globalModifiers.discount) {
    calculatedGlobalDiscount = calculateModifier(
      globalModifiers.discount,
      base,
    );
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

  if (portalModifiers.oversize) {
    switch (vehicle.class) {
      case VehicleClass.SUV:
        calculatedPortalOversize = calculateModifier(
          { value: portalModifiers.oversize.suv, valueType: "flat" },
          base,
        );
        break;
      case VehicleClass.Van:
        calculatedPortalOversize = calculateModifier(
          { value: portalModifiers.oversize.van, valueType: "flat" },
          base,
        );
        break;
      case VehicleClass.Pickup2Door:
        calculatedPortalOversize = calculateModifier(
          { value: portalModifiers.oversize.pickup_2_door, valueType: "flat" },
          base,
        );
        break;
      case VehicleClass.Pickup4Door:
        calculatedPortalOversize = calculateModifier(
          { value: portalModifiers.oversize.pickup_4_door, valueType: "flat" },
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

  return {
    base,
    globalModifiers: {
      inoperable: calculatedInoperable,
      discount: calculatedGlobalDiscount,
      routes: calculatedRoutes,
    },
    portalModifiers: {
      enclosed: portalModifiers.enclosed,
      commission,
      companyTariff: calculatedTariff,
      discount: calculatedPortalDiscount,
      oversize: calculatedPortalOversize,
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
