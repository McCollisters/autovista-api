import { IVehicle } from "../../_global/interfaces";
import { ModifierSet, IPortal } from "@/_global/models";
import { getTMSBaseRate } from "../integrations/getTMSBaseRate";
import { getCustomBaseRate } from "../integrations/getCustomBaseRate";
import { ServiceLevelOption, VehicleClass } from "../../_global/enums";
import { IVehicleModifier, IModifierSet } from "../../modifierSet/schema";
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
  const globalModifiers = (await ModifierSet.findOne({
    isGlobal: true,
  }).lean()) as any;

  // Get portal-specific modifiers
  const portalModifiers = (await ModifierSet.findOne({
    portalId: portal._id,
  }).lean()) as any;

  if (!globalModifiers) {
    return null;
  }

  // Get vehicle base rate from Super Dispatch or portal's custom rates
  const baseTms = (await getTMSBaseRate(vehicle, origin, destination))?.quote;
  const baseCustom = getCustomBaseRate(miles, portal);
  const base = portal.options?.enableCustomRates ? baseCustom : baseTms;

  const whiteGloveMultiplier = portalModifiers?.whiteGlove
    ? portalModifiers.whiteGlove.multiplier
    : globalModifiers.whiteGlove?.multiplier || 2;

  let baseWhiteGlove = miles * whiteGloveMultiplier;

  if (baseWhiteGlove < globalModifiers.whiteGlove.minimum) {
    baseWhiteGlove = globalModifiers.whiteGlove.minimum;
  }

  let calculatedCommission = commission;
  let calculatedGlobalDiscount: number = 0;
  let calculatedPortalDiscount: number = 0;
  let calculatedInoperable: number = 0;
  let calculatedGlobalOversize: number = 0;
  let calculatedRoutes: number = 0;
  let calculatedStates: number = 0;
  let calculatedEnclosedFlat: number = 0;
  let calculatedEnclosedPercent: number = 0;
  let calculatedVehicles: number = 0;
  let calculatedIrr: number = 0;
  let calculatedFuel: number = 0;

  const calculateServiceLevelTotals = (
    serviceLevelIndex: number,
    isEnclosed: boolean,
  ) => {
    // Calculate base with all modifiers
    const baseWithModifiers =
      base +
      calculatedInoperable +
      calculatedRoutes +
      calculatedStates +
      calculatedVehicles +
      calculatedGlobalDiscount +
      calculatedPortalDiscount +
      calculatedIrr +
      calculatedFuel +
      (globalModifiers.serviceLevels?.[serviceLevelIndex]?.value || 0) +
      (isEnclosed ? calculatedEnclosedFlat + calculatedEnclosedPercent : 0);

    // WhiteGlove (service level index 4) doesn't use company tariffs
    if (serviceLevelIndex === 4) {
      return { companyTariff: 0, baseWithModifiers: 0 };
    }

    if (!portalModifiers?.companyTariff) {
      return { companyTariff: 0, baseWithModifiers };
    }

    // Apply company tariff discount if exists (discount will be negative value)
    let baseForCompanyTariff = baseWithModifiers;
    if (portalModifiers.companyTariffDiscount) {
      baseForCompanyTariff += calculateModifier(
        portalModifiers.companyTariffDiscount,
        baseWithModifiers,
      );
    }

    // Calculate company tariff using the modified base
    let companyTariff = calculateModifier(
      portalModifiers.companyTariff,
      baseForCompanyTariff,
    );

    // Add enclosed extra fee if applicable (added to the company tariff at the end)
    if (isEnclosed && portalModifiers?.companyTariffEnclosedFee) {
      companyTariff += calculateModifier(
        portalModifiers.companyTariffEnclosedFee,
        baseWithModifiers,
      );
    }

    return { companyTariff, baseWithModifiers };
  };

  if (globalModifiers.discount) {
    calculatedGlobalDiscount = calculateModifier(
      globalModifiers.discount,
      base,
    );
  }

  if (portalModifiers?.fixedCommission) {
    calculatedCommission = calculateModifier(
      portalModifiers.fixedCommission,
      base,
    );
  }

  if (portalModifiers?.discount) {
    calculatedPortalDiscount = calculateModifier(
      portalModifiers.discount,
      base,
    );
  }

  if (vehicle.isOversize && globalModifiers.oversize) {
    switch (vehicle.pricingClass) {
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
          { value: globalModifiers.oversize.pickup_2_doors, valueType: "flat" },
          base,
        );
        break;
      case VehicleClass.Pickup4Door:
        calculatedGlobalOversize = calculateModifier(
          { value: globalModifiers.oversize.pickup_4_doors, valueType: "flat" },
          base,
        );
        break;
      case VehicleClass.Sedan:
        // Use sedan value if available, otherwise use a default value
        const sedanValue = globalModifiers.oversize.sedan || 1000;
        calculatedGlobalOversize = calculateModifier(
          { value: sedanValue, valueType: "flat" },
          base,
        );
        break;
      default:
        // For other vehicle classes, use a default oversize value if isOversize is true
        if (globalModifiers.oversize.default) {
          calculatedGlobalOversize = calculateModifier(
            { value: globalModifiers.oversize.default, valueType: "flat" },
            base,
          );
        }
        break;
    }
  }

  if (vehicle.isInoperable && globalModifiers.inoperable) {
    calculatedInoperable = calculateModifier(globalModifiers.inoperable, base);
  }

  // Only apply enclosed modifiers if the vehicle is using enclosed transport
  const isEnclosedTransport = vehicle.transportType === "enclosed";

  if (isEnclosedTransport && globalModifiers.enclosedFlat) {
    calculatedEnclosedFlat = calculateModifier(
      globalModifiers.enclosedFlat,
      base,
    );
  }

  if (isEnclosedTransport && globalModifiers.enclosedPercent) {
    calculatedEnclosedPercent = calculateModifier(
      globalModifiers.enclosedPercent,
      base,
    );
  }

  const originState = origin.split(",")[1]?.trim();
  const destinationState = destination.split(",")[1]?.trim();

  if (globalModifiers.routes) {
    if (Array.isArray(globalModifiers.routes)) {
      const matchingRoutes = globalModifiers.routes.filter(
        (route: any) =>
          route.origin === originState &&
          route.destination === destinationState,
      );

      matchingRoutes.forEach((route: any) => {
        let calculatedValue = calculateModifier(route, base);
        calculatedRoutes += calculatedValue;
      });
    }
  }

  if (globalModifiers.states) {
    // Handle both Map and plain object cases (lean() converts Map to plain object)
    const getStateModifier = (state: string) => {
      if (globalModifiers.states instanceof Map) {
        return globalModifiers.states.get(state);
      } else {
        return globalModifiers.states[state];
      }
    };

    // Check origin state for outbound or both directions
    const originModifier = getStateModifier(originState);
    if (
      originModifier &&
      (originModifier.direction === "outbound" ||
        originModifier.direction === "both")
    ) {
      calculatedStates += calculateModifier(
        { value: originModifier.value, valueType: originModifier.valueType },
        base,
      );
    }

    // Check destination state for inbound or both directions (avoid double-counting if same state)
    const destinationModifier = getStateModifier(destinationState);
    if (
      destinationModifier &&
      (destinationModifier.direction === "inbound" ||
        (destinationModifier.direction === "both" &&
          destinationState !== originState))
    ) {
      calculatedStates += calculateModifier(
        {
          value: destinationModifier.value,
          valueType: destinationModifier.valueType,
        },
        base,
      );
    }
  }

  if (globalModifiers.vehicles) {
    if (Array.isArray(globalModifiers.vehicles)) {
      const matchingVehicles = globalModifiers.vehicles.filter(
        (v: IVehicleModifier) =>
          v.makeModel[0] === vehicle.make && v.makeModel[1] === vehicle.model,
      );

      matchingVehicles.forEach((v: any) => {
        let calculatedValue = calculateModifier(v, base);
        calculatedVehicles += calculatedValue;
      });
    }
  }

  // Pre-calculate all service level data once
  const serviceLevelData = {
    whiteGlove: calculateServiceLevelTotals(4, false),
    oneOpen: calculateServiceLevelTotals(0, false),
    oneEnclosed: calculateServiceLevelTotals(0, isEnclosedTransport),
    three: calculateServiceLevelTotals(1, false),
    five: calculateServiceLevelTotals(2, false),
    seven: calculateServiceLevelTotals(3, false),
  };

  // Populate company tariff array with service level data (excluding WhiteGlove)
  let companyTarriffArray = [
    {
      serviceLevelOption: ServiceLevelOption.OneDay,
      value: serviceLevelData.oneOpen.companyTariff,
    },
    {
      serviceLevelOption: ServiceLevelOption.ThreeDay,
      value: serviceLevelData.three.companyTariff,
    },
    {
      serviceLevelOption: ServiceLevelOption.FiveDay,
      value: serviceLevelData.five.companyTariff,
    },
    {
      serviceLevelOption: ServiceLevelOption.SevenDay,
      value: serviceLevelData.seven.companyTariff,
    },
  ];

  return {
    base,
    modifiers: {
      inoperable: calculatedInoperable,
      routes: calculatedRoutes,
      states: calculatedStates,
      oversize: calculatedGlobalOversize,
      vehicles: calculatedVehicles,
      globalDiscount: calculatedGlobalDiscount,
      portalDiscount: calculatedPortalDiscount,
      irr: calculatedIrr,
      fuel: calculatedFuel,
      enclosedFlat: calculatedEnclosedFlat,
      enclosedPercent: calculatedEnclosedPercent,
      commission: calculatedCommission,
      serviceLevels: globalModifiers.serviceLevels,
      companyTariffs: companyTarriffArray,
    },
    totals: {
      whiteGlove: roundCurrency(baseWhiteGlove),
      one: {
        open: {
          total: roundCurrency(serviceLevelData.oneOpen.baseWithModifiers),
          companyTariff: serviceLevelData.oneOpen.companyTariff,
          commission: calculatedCommission,
          totalWithCompanyTariffAndCommission: roundCurrency(
            serviceLevelData.oneOpen.baseWithModifiers +
              calculatedCommission +
              serviceLevelData.oneOpen.companyTariff,
          ),
        },
        enclosed: {
          total: roundCurrency(serviceLevelData.oneEnclosed.baseWithModifiers),
          companyTariff: serviceLevelData.oneEnclosed.companyTariff,
          commission: calculatedCommission,
          totalWithCompanyTariffAndCommission: roundCurrency(
            serviceLevelData.oneEnclosed.baseWithModifiers +
              calculatedCommission +
              serviceLevelData.oneEnclosed.companyTariff,
          ),
        },
      },
      three: {
        total: roundCurrency(serviceLevelData.three.baseWithModifiers),
        companyTariff: serviceLevelData.three.companyTariff,
        commission: calculatedCommission,
        totalWithCompanyTariffAndCommission: roundCurrency(
          serviceLevelData.three.baseWithModifiers +
            calculatedCommission +
            serviceLevelData.three.companyTariff,
        ),
      },
      five: {
        total: roundCurrency(serviceLevelData.five.baseWithModifiers),
        companyTariff: serviceLevelData.five.companyTariff,
        commission: calculatedCommission,
        totalWithCompanyTariffAndCommission: roundCurrency(
          serviceLevelData.five.baseWithModifiers +
            calculatedCommission +
            serviceLevelData.five.companyTariff,
        ),
      },
      seven: {
        total: roundCurrency(serviceLevelData.seven.baseWithModifiers),
        companyTariff: serviceLevelData.seven.companyTariff,
        commission: calculatedCommission,
        totalWithCompanyTariffAndCommission: roundCurrency(
          serviceLevelData.seven.baseWithModifiers +
            calculatedCommission +
            serviceLevelData.seven.companyTariff,
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
