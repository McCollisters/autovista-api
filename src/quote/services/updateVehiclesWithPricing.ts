import { IVehicle } from "../../_global/interfaces";
import { IVehicleModifier, ModifierSet } from "../../modifierSet/schema";
import { getTMSBaseRate } from "../integrations/getTMSBaseRate";
import { getCustomBaseRate } from "../integrations/getCustomBaseRate";
import { ServiceLevelOption, VehicleClass } from "../../_global/enums";
import { IPortal } from "../../portal/schema";
import { roundCurrency } from "../../_global/utils/roundCurrency";
import { Types } from "mongoose";

interface VehiclePriceParams {
  portal: IPortal;
  vehicle: Partial<IVehicle>;
  miles: number;
  origin: string;
  destination: string;
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
    destination,
    portal,
    commission = 0,
  } = params;

  // Get Autovista-wide modifiers
  const globalModifiers = await ModifierSet.findOne({ isGlobal: true });

  // Get portal-specific modifiers
  const portalModifiers = await ModifierSet.findOne({
    portalId: portal._id,
  });

  if (!globalModifiers) {
    return null;
  }

  // Get vehicle base rate from Super Dispatch or portal's custom rates
  const baseTms = (await getTMSBaseRate(vehicle, origin, destination))?.quote;
  const baseCustom = getCustomBaseRate(miles, portal);

  const whiteGloveMultiplier = portalModifiers?.whiteGlove
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
  let calculatedStates: number = 0;
  let calculatedEnclosedFlat: number = 0;
  let calculatedEnclosedPercent: number = 0;
  let calculatedVehicles: number = 0;

  const baseForModifiers = portal.options?.enableCustomRates
    ? baseCustom
    : baseTms;

  if (globalModifiers.discount) {
    calculatedGlobalDiscount = calculateModifier(
      globalModifiers.discount,
      baseForModifiers,
    );
  }

  if (portalModifiers?.fixedCommission) {
    calculatedCommission = calculateModifier(
      portalModifiers.fixedCommission,
      baseForModifiers,
    );
  }

  if (portalModifiers?.companyTariff) {
    calculatedTariff = calculateModifier(
      portalModifiers.companyTariff,
      baseForModifiers,
    );
  }

  if (portalModifiers?.discount) {
    calculatedPortalDiscount = calculateModifier(
      portalModifiers.discount,
      baseForModifiers,
    );
  }

  if (globalModifiers.oversize) {
    switch (vehicle.pricingClass) {
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
          { value: globalModifiers.oversize.pickup_2_doors, valueType: "flat" },
          baseForModifiers,
        );
        break;
      case VehicleClass.Pickup4Door:
        calculatedGlobalOversize = calculateModifier(
          { value: globalModifiers.oversize.pickup_4_doors, valueType: "flat" },
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

  if (globalModifiers.enclosedFlat) {
    calculatedEnclosedFlat = calculateModifier(
      globalModifiers.enclosedFlat,
      baseForModifiers,
    );
  }

  if (globalModifiers.enclosedPercent) {
    calculatedEnclosedPercent = calculateModifier(
      globalModifiers.enclosedPercent,
      baseForModifiers,
    );
  }

  const originState = origin.split(",")[1]?.trim();
  const destinationState = destination.split(",")[1]?.trim();

  if (globalModifiers.routes) {
    if (Array.isArray(globalModifiers.routes)) {
      const matchingRoutes = globalModifiers.routes.filter(
        (route) =>
          route.origin === originState &&
          route.destination === destinationState,
      );

      matchingRoutes.forEach((route) => {
        let calculatedValue = calculateModifier(route, baseForModifiers);
        calculatedRoutes += calculatedValue;
      });
    }
  }

  if (globalModifiers.states) {
    // Check origin state for outbound or both directions
    const originModifier = globalModifiers.states.get(originState);
    if (
      originModifier &&
      (originModifier.direction === "outbound" ||
        originModifier.direction === "both")
    ) {
      calculatedStates += calculateModifier(originModifier, baseForModifiers);
    }

    // Check destination state for inbound or both directions (avoid double-counting if same state)
    const destinationModifier = globalModifiers.states.get(destinationState);
    if (
      destinationModifier &&
      (destinationModifier.direction === "inbound" ||
        (destinationModifier.direction === "both" &&
          destinationState !== originState))
    ) {
      calculatedStates += calculateModifier(
        destinationModifier,
        baseForModifiers,
      );
    }
  }

  if (globalModifiers.vehicles) {
    if (Array.isArray(globalModifiers.vehicles)) {
      const matchingVehicles = globalModifiers.vehicles.filter(
        (v: IVehicleModifier) =>
          v.makeModel[0] === vehicle.make && v.makeModel[1] === vehicle.model,
      );

      matchingVehicles.forEach((v) => {
        let calculatedValue = calculateModifier(v, baseForModifiers);
        calculatedVehicles += calculatedValue;
      });
    }
  }

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
        states: calculatedStates,
        oversize: calculatedGlobalOversize,
        vehicles: calculatedVehicles,
      },
      portal: {
        commission: calculatedCommission,
        companyTariff: calculatedTariff,
        discount: calculatedPortalDiscount,
      },
      conditional: {
        enclosedFlat: calculatedEnclosedFlat,
        enclosedPercent: calculatedEnclosedPercent,
        serviceLevels: globalModifiers.serviceLevels,
      },
    },
    total: {
      whiteGlove: {
        enclosedTms: roundCurrency(baseWhiteGlove),
        enclosed: roundCurrency(
          baseWhiteGlove + calculatedCommission + calculatedTariff,
        ),
      },
      withoutServiceLevel: {
        open: roundCurrency(
          baseForModifiers +
            calculatedInoperable +
            calculatedGlobalDiscount +
            calculatedRoutes +
            calculatedStates +
            calculatedVehicles +
            calculatedCommission +
            calculatedTariff +
            calculatedPortalDiscount +
            calculatedGlobalOversize,
        ),
        openTms: roundCurrency(
          baseForModifiers +
            calculatedInoperable +
            calculatedGlobalDiscount +
            calculatedRoutes +
            calculatedStates +
            calculatedVehicles +
            calculatedPortalDiscount +
            calculatedGlobalOversize,
        ),
        enclosed: roundCurrency(
          baseForModifiers +
            calculatedInoperable +
            calculatedGlobalDiscount +
            calculatedRoutes +
            calculatedStates +
            calculatedVehicles +
            calculatedCommission +
            calculatedTariff +
            calculatedPortalDiscount +
            calculatedGlobalOversize +
            calculatedEnclosedFlat +
            calculatedEnclosedPercent,
        ),
        enclosedTms: roundCurrency(
          baseForModifiers +
            calculatedInoperable +
            calculatedGlobalDiscount +
            calculatedRoutes +
            calculatedStates +
            calculatedVehicles +
            calculatedPortalDiscount +
            calculatedGlobalOversize +
            calculatedEnclosedFlat +
            calculatedEnclosedPercent,
        ),
      },
    },
  };
};

export const updateVehiclesWithPricing = async ({
  portal,
  vehicles,
  miles,
  origin,
  destination,
  commission,
}: {
  portal: IPortal;
  vehicles: Array<Partial<IVehicle>>;
  miles: number;
  origin: string;
  destination: string;
  commission: number;
}): Promise<IVehicle[]> => {
  const updatedVehicles: IVehicle[] = [];

  for (const vehicle of vehicles) {
    const pricing = await getVehiclePrice({
      vehicle,
      miles,
      origin,
      destination,
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
