import { IVehicle } from "../../_global/interfaces";
import { ModifierSet, IPortal } from "@/_global/models";
import { getTMSBaseRate } from "../integrations/getTMSBaseRate";
import { getCustomBaseRate } from "../integrations/getCustomBaseRate";
import { getJKBaseRate } from "../integrations/getJKBaseRate";
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
  const globalModifiersDoc = await ModifierSet.findOne({
    isGlobal: true,
  });

  if (!globalModifiersDoc) {
    return null;
  }

  const globalModifiers = globalModifiersDoc.toObject() as any;

  // Get portal-specific modifiers
  const portalModifiers = (await ModifierSet.findOne({
    portalId: portal._id,
  }).lean()) as any;

  if (!globalModifiers) {
    return null;
  }

  // Check if JK rate calculation is enabled
  if (portal.options?.enableJKRateCalculation) {
    return getJKVehiclePrice({
      vehicle,
      miles,
      portal,
      commission,
      globalModifiers,
      portalModifiers,
    });
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
        const sedanValue = (globalModifiers.oversize as any).sedan || 1000;
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
      const states = globalModifiers.states;
      if (!states) return undefined;
      if (states instanceof Map) {
        return states.get(state);
      } else {
        return states[state];
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

/**
 * JK Moving Rate Calculation
 *
 * Implements the JK-specific 70/30 split calculation:
 * - MC base = 70% of original base
 * - Company tariff = 30% of original base
 * - No state modifiers
 * - No service level markup (all service levels have same price)
 */
const getJKVehiclePrice = async ({
  vehicle,
  miles,
  portal,
  commission,
  globalModifiers,
  portalModifiers,
}: {
  vehicle: Partial<IVehicle>;
  miles: number;
  portal: IPortal;
  commission: number;
  globalModifiers: any;
  portalModifiers: any;
}): Promise<any> => {
  const portalAny = portal as any;
  const customRates = portalAny.customRates || {};
  const discount = 0; // Discount would come from quote, but for now default to 0

  // Get base quote from JK mileage structure
  let baseQuote = getJKBaseRate(miles, portal);

  if (baseQuote === 0) {
    return null;
  }

  // Apply discount if any
  baseQuote -= discount;

  // Company tariff percent defaults to 0.3 (30%) for JK Moving
  const companyTariffPercent = portalAny.companyTariff
    ? portalAny.companyTariff / 100
    : 0.3;

  // Calculate company tariff (30% of original base)
  let companyTariff = Math.floor(baseQuote * companyTariffPercent);

  // MC base is 70% of original base (original - company tariff)
  let mcBase = baseQuote - companyTariff;

  // Determine transport type
  const isEnclosed =
    vehicle.transportType === "enclosed" ||
    vehicle.transportType === "WHITEGLOVE";

  // Apply enclosed modifier if applicable
  if (isEnclosed && globalModifiers.enclosedModifier) {
    const enclosedModifierAmt = Math.ceil(
      mcBase * (globalModifiers.enclosedModifier / 100),
    );
    // Note: JK doesn't add this to base, it's just calculated
  }

  // Apply enclosed surcharge
  let enclosedMarkup = 0;
  if (isEnclosed) {
    if (miles > 1500 && customRates.enclosedSurchargeOver1500) {
      enclosedMarkup = customRates.enclosedSurchargeOver1500;
    } else if (customRates.enclosedSurcharge) {
      enclosedMarkup = customRates.enclosedSurcharge;
    }
  }

  // Apply vehicle class surcharges
  const pricingClass = vehicle.pricingClass?.toLowerCase() || "";

  if (pricingClass === "suv" && customRates.suvClassSurcharge) {
    mcBase += customRates.suvClassSurcharge;
  }

  if (pricingClass === "van" && customRates.vanClassSurcharge) {
    mcBase += customRates.vanClassSurcharge;
  }

  if (
    pricingClass === "pick up 4 doors" &&
    customRates.pickUp4DoorClassSurcharge
  ) {
    mcBase += customRates.pickUp4DoorClassSurcharge;
  }

  // Apply inoperable markup
  let inoperableMarkup = 0;
  if (vehicle.isInoperable && globalModifiers.inoperable) {
    inoperableMarkup = calculateModifier(globalModifiers.inoperable, mcBase);
  }

  // Apply portal admin discount to company tariff if applicable
  const portalAdminDiscount = portalAny.portalAdminDiscount || 0;
  if (portalAdminDiscount > 0 && companyTariff > portalAdminDiscount) {
    companyTariff = companyTariff - portalAdminDiscount;
  }

  // JK: No service level markup - all service levels have same price
  const serviceLevelMarkup = 0;

  // Calculate totals (same for all service levels in JK)
  const totalSD =
    mcBase + enclosedMarkup + serviceLevelMarkup + inoperableMarkup;
  const totalPortal =
    mcBase +
    enclosedMarkup +
    serviceLevelMarkup +
    inoperableMarkup +
    commission +
    companyTariff;

  // Return pricing structure matching the standard format
  return {
    base: roundCurrency(mcBase),
    modifiers: {
      inoperable: inoperableMarkup,
      routes: 0, // JK: No state modifiers
      states: 0, // JK: No state modifiers
      oversize: 0,
      vehicles: 0,
      globalDiscount: 0,
      portalDiscount: 0,
      irr: 0,
      fuel: 0,
      enclosedFlat: enclosedMarkup,
      enclosedPercent: 0,
      commission: commission,
      serviceLevels: [], // JK: No service level variations
      companyTariffs: [
        { serviceLevelOption: ServiceLevelOption.OneDay, value: companyTariff },
        {
          serviceLevelOption: ServiceLevelOption.ThreeDay,
          value: companyTariff,
        },
        {
          serviceLevelOption: ServiceLevelOption.FiveDay,
          value: companyTariff,
        },
        {
          serviceLevelOption: ServiceLevelOption.SevenDay,
          value: companyTariff,
        },
      ],
    },
    totals: {
      whiteGlove: roundCurrency(totalSD), // Same as other service levels
      one: {
        open: {
          total: roundCurrency(totalSD),
          companyTariff: companyTariff,
          commission: commission,
          totalWithCompanyTariffAndCommission: roundCurrency(totalPortal),
        },
        enclosed: {
          total: roundCurrency(totalSD),
          companyTariff: companyTariff,
          commission: commission,
          totalWithCompanyTariffAndCommission: roundCurrency(totalPortal),
        },
      },
      three: {
        total: roundCurrency(totalSD),
        companyTariff: companyTariff,
        commission: commission,
        totalWithCompanyTariffAndCommission: roundCurrency(totalPortal),
      },
      five: {
        total: roundCurrency(totalSD),
        companyTariff: companyTariff,
        commission: commission,
        totalWithCompanyTariffAndCommission: roundCurrency(totalPortal),
      },
      seven: {
        total: roundCurrency(totalSD),
        companyTariff: companyTariff,
        commission: commission,
        totalWithCompanyTariffAndCommission: roundCurrency(totalPortal),
      },
    },
  };
};
