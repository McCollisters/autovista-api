import { IVehicle } from "../../_global/interfaces";
import { ModifierSet, IPortal, Brand } from "@/_global/models";
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
    throw new Error("Global modifier set not found");
  }

  const globalModifiers = (globalModifiersDoc.toObject ? globalModifiersDoc.toObject() : globalModifiersDoc) as any;

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

  if (globalModifiers.whiteGlove?.minimum && baseWhiteGlove < globalModifiers.whiteGlove.minimum) {
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
    const fixedCommissionValue = calculateModifier(
      portalModifiers.fixedCommission,
      base,
    );
    // Add fixedCommission to the quote's commission if both exist
    calculatedCommission = commission + fixedCommissionValue;
  }

  if (portalModifiers?.discount) {
    calculatedPortalDiscount = calculateModifier(
      portalModifiers.discount,
      base,
    );
  }

  if (vehicle.isOversize && globalModifiers.oversize) {
    // Normalize pricing class to ensure it matches enum values (case-insensitive)
    const pricingClassNormalized = (vehicle.pricingClass || "").toLowerCase().trim();
    
    // Check for SUV
    if (pricingClassNormalized === VehicleClass.SUV || pricingClassNormalized === "suv") {
      const suvValue = globalModifiers.oversize.suv;
      if (suvValue !== undefined && suvValue !== null) {
        calculatedGlobalOversize = calculateModifier(
          { value: suvValue, valueType: "flat" },
          base,
        );
      }
    }
    // Check for Van
    else if (pricingClassNormalized === VehicleClass.Van || pricingClassNormalized === "van") {
      const vanValue = globalModifiers.oversize.van;
      if (vanValue !== undefined && vanValue !== null) {
        calculatedGlobalOversize = calculateModifier(
          { value: vanValue, valueType: "flat" },
          base,
        );
      }
    }
    // Check for Pickup 2 Door
    else if (
      pricingClassNormalized === VehicleClass.Pickup2Door ||
      pricingClassNormalized === "pickup_2_doors" ||
      pricingClassNormalized === "pickup 2 doors" ||
      pricingClassNormalized === "pick up 2 doors"
    ) {
      const pickup2Value = globalModifiers.oversize.pickup_2_doors;
      if (pickup2Value !== undefined && pickup2Value !== null) {
        calculatedGlobalOversize = calculateModifier(
          { value: pickup2Value, valueType: "flat" },
          base,
        );
      }
    }
    // Check for Pickup 4 Door
    else if (
      pricingClassNormalized === VehicleClass.Pickup4Door ||
      pricingClassNormalized === "pickup_4_doors" ||
      pricingClassNormalized === "pickup 4 doors" ||
      pricingClassNormalized === "pick up 4 doors"
    ) {
      const pickup4Value = globalModifiers.oversize.pickup_4_doors;
      if (pickup4Value !== undefined && pickup4Value !== null) {
        calculatedGlobalOversize = calculateModifier(
          { value: pickup4Value, valueType: "flat" },
          base,
        );
      }
    }
    // Check for Sedan
    else if (pricingClassNormalized === VehicleClass.Sedan || pricingClassNormalized === "sedan") {
      const sedanValue = (globalModifiers.oversize as any).sedan || 1000;
      calculatedGlobalOversize = calculateModifier(
        { value: sedanValue, valueType: "flat" },
        base,
      );
    }
    // Default case
    else {
      if (globalModifiers.oversize.default) {
        calculatedGlobalOversize = calculateModifier(
          { value: globalModifiers.oversize.default, valueType: "flat" },
          base,
        );
      }
    }
  }

  if (vehicle.isInoperable && globalModifiers.inoperable) {
    calculatedInoperable = calculateModifier(globalModifiers.inoperable, base);
  }

  // Always calculate enclosed modifiers (for display purposes, we show both open and enclosed options)
  // These will be applied when calculating enclosed pricing, regardless of vehicle transport type
  if (globalModifiers.enclosedFlat) {
    calculatedEnclosedFlat = calculateModifier(
      globalModifiers.enclosedFlat,
      base,
    );
  }

  if (globalModifiers.enclosedPercent) {
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
    oneEnclosed: calculateServiceLevelTotals(0, true),
    threeOpen: calculateServiceLevelTotals(1, false),
    threeEnclosed: calculateServiceLevelTotals(1, true),
    fiveOpen: calculateServiceLevelTotals(2, false),
    fiveEnclosed: calculateServiceLevelTotals(2, true),
    sevenOpen: calculateServiceLevelTotals(3, false),
    sevenEnclosed: calculateServiceLevelTotals(3, true),
  };

  // Populate company tariff array with service level data (excluding WhiteGlove)
  // Use open pricing for company tariff array (legacy structure)
  let companyTarriffArray = [
    {
      serviceLevelOption: ServiceLevelOption.OneDay,
      value: serviceLevelData.oneOpen.companyTariff,
    },
    {
      serviceLevelOption: ServiceLevelOption.ThreeDay,
      value: serviceLevelData.threeOpen.companyTariff,
    },
    {
      serviceLevelOption: ServiceLevelOption.FiveDay,
      value: serviceLevelData.fiveOpen.companyTariff,
    },
    {
      serviceLevelOption: ServiceLevelOption.SevenDay,
      value: serviceLevelData.sevenOpen.companyTariff,
    },
  ];

  // Build totals object with open/enclosed structure for all service levels
  const totals = {
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
      open: {
        total: roundCurrency(serviceLevelData.threeOpen.baseWithModifiers),
        companyTariff: serviceLevelData.threeOpen.companyTariff,
        commission: calculatedCommission,
        totalWithCompanyTariffAndCommission: roundCurrency(
          serviceLevelData.threeOpen.baseWithModifiers +
            calculatedCommission +
            serviceLevelData.threeOpen.companyTariff,
        ),
      },
      enclosed: {
        total: roundCurrency(serviceLevelData.threeEnclosed.baseWithModifiers),
        companyTariff: serviceLevelData.threeEnclosed.companyTariff,
        commission: calculatedCommission,
        totalWithCompanyTariffAndCommission: roundCurrency(
          serviceLevelData.threeEnclosed.baseWithModifiers +
            calculatedCommission +
            serviceLevelData.threeEnclosed.companyTariff,
        ),
      },
      // Legacy fallback - use open pricing (include commission)
      total: roundCurrency(serviceLevelData.threeOpen.baseWithModifiers),
      companyTariff: serviceLevelData.threeOpen.companyTariff,
      commission: calculatedCommission,
      totalWithCompanyTariffAndCommission: roundCurrency(
        serviceLevelData.threeOpen.baseWithModifiers +
          calculatedCommission +
          serviceLevelData.threeOpen.companyTariff,
      ),
    },
    five: {
      open: {
        total: roundCurrency(serviceLevelData.fiveOpen.baseWithModifiers),
        companyTariff: serviceLevelData.fiveOpen.companyTariff,
        commission: calculatedCommission,
        totalWithCompanyTariffAndCommission: roundCurrency(
          serviceLevelData.fiveOpen.baseWithModifiers +
            calculatedCommission +
            serviceLevelData.fiveOpen.companyTariff,
        ),
      },
      enclosed: {
        total: roundCurrency(serviceLevelData.fiveEnclosed.baseWithModifiers),
        companyTariff: serviceLevelData.fiveEnclosed.companyTariff,
        commission: calculatedCommission,
        totalWithCompanyTariffAndCommission: roundCurrency(
          serviceLevelData.fiveEnclosed.baseWithModifiers +
            calculatedCommission +
            serviceLevelData.fiveEnclosed.companyTariff,
        ),
      },
      // Legacy fallback - use open pricing (include commission)
      total: roundCurrency(serviceLevelData.fiveOpen.baseWithModifiers),
      companyTariff: serviceLevelData.fiveOpen.companyTariff,
      commission: calculatedCommission,
      totalWithCompanyTariffAndCommission: roundCurrency(
        serviceLevelData.fiveOpen.baseWithModifiers +
          calculatedCommission +
          serviceLevelData.fiveOpen.companyTariff,
      ),
    },
    seven: {
      open: {
        total: roundCurrency(serviceLevelData.sevenOpen.baseWithModifiers),
        companyTariff: serviceLevelData.sevenOpen.companyTariff,
        commission: calculatedCommission,
        totalWithCompanyTariffAndCommission: roundCurrency(
          serviceLevelData.sevenOpen.baseWithModifiers +
            calculatedCommission +
            serviceLevelData.sevenOpen.companyTariff,
        ),
      },
      enclosed: {
        total: roundCurrency(serviceLevelData.sevenEnclosed.baseWithModifiers),
        companyTariff: serviceLevelData.sevenEnclosed.companyTariff,
        commission: calculatedCommission,
        totalWithCompanyTariffAndCommission: roundCurrency(
          serviceLevelData.sevenEnclosed.baseWithModifiers +
            calculatedCommission +
            serviceLevelData.sevenEnclosed.companyTariff,
        ),
      },
      // Legacy fallback - use open pricing (include commission)
      total: roundCurrency(serviceLevelData.sevenOpen.baseWithModifiers),
      companyTariff: serviceLevelData.sevenOpen.companyTariff,
      commission: calculatedCommission,
      totalWithCompanyTariffAndCommission: roundCurrency(
        serviceLevelData.sevenOpen.baseWithModifiers +
          calculatedCommission +
          serviceLevelData.sevenOpen.companyTariff,
      ),
    },
  };


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
    totals,
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
    // Look up pricing class from brand/model data if not already set or if it needs to be corrected
    let pricingClass = vehicle.pricingClass;
    
    if (vehicle.make && vehicle.model) {
      try {
        const brand = await Brand.findOne({ 
          make: { $regex: new RegExp(`^${vehicle.make}$`, 'i') } 
        }).lean();
        
        if (brand && brand.models) {
          const modelData = brand.models.find(
            (m) => m.model.toLowerCase() === vehicle.model?.toLowerCase()
          );
          
          if (modelData && modelData.pricingClass) {
            // Use the pricing class from brand/model data
            // Normalize to match VehicleClass enum values (lowercase)
            const normalizedPricingClass = modelData.pricingClass.toLowerCase().trim();
            
            // Map common variations to VehicleClass enum values
            const pricingClassMap: Record<string, string> = {
              'suv': VehicleClass.SUV,
              'sedan': VehicleClass.Sedan,
              'van': VehicleClass.Van,
              'pickup_4_doors': VehicleClass.Pickup4Door,
              'pickup 4 doors': VehicleClass.Pickup4Door,
              'pick up 4 doors': VehicleClass.Pickup4Door,
              'pickup_2_doors': VehicleClass.Pickup2Door,
              'pickup 2 doors': VehicleClass.Pickup2Door,
              'pick up 2 doors': VehicleClass.Pickup2Door,
              'other': VehicleClass.Other,
            };
            
            // Use mapped value if available, otherwise use the original (schema validation will catch invalid values)
            pricingClass = pricingClassMap[normalizedPricingClass] || modelData.pricingClass;
          }
        }
      } catch (error) {
        // If lookup fails, continue with existing pricingClass or default
        console.warn(`Failed to lookup pricing class for ${vehicle.make} ${vehicle.model}:`, error);
      }
    }
    
    // Determine final pricing class
    const finalPricingClass = pricingClass || vehicle.pricingClass || VehicleClass.Sedan;
    
    // Automatically set isOversize to true for SUVs, vans, and pickups if not explicitly set
    const shouldBeOversize = 
      finalPricingClass === VehicleClass.SUV ||
      finalPricingClass === VehicleClass.Van ||
      finalPricingClass === VehicleClass.Pickup2Door ||
      finalPricingClass === VehicleClass.Pickup4Door;
    
    // Use the looked-up pricing class (or existing one if lookup didn't find anything)
    const vehicleWithPricingClass = {
      ...vehicle,
      pricingClass: finalPricingClass,
      // Set isOversize to true for SUVs, vans, and pickups if not explicitly set to false
      isOversize: vehicle.isOversize !== undefined ? vehicle.isOversize : shouldBeOversize,
    };

    const pricing = await getVehiclePrice({
      vehicle: vehicleWithPricingClass,
      miles,
      origin,
      destination,
      portal,
      commission,
    });

    updatedVehicles.push({
      ...vehicleWithPricingClass,
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

  // Calculate commission: add fixedCommission from modifier set to quote's commission if both exist
  let calculatedCommission = commission;
  if (portalModifiers?.fixedCommission) {
    const fixedCommissionValue = calculateModifier(
      portalModifiers.fixedCommission,
      mcBase,
    );
    calculatedCommission = commission + fixedCommissionValue;
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
    calculatedCommission +
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
      commission: calculatedCommission,
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
          commission: calculatedCommission,
          totalWithCompanyTariffAndCommission: roundCurrency(totalPortal),
        },
        enclosed: {
          total: roundCurrency(totalSD),
          companyTariff: companyTariff,
          commission: calculatedCommission,
          totalWithCompanyTariffAndCommission: roundCurrency(totalPortal),
        },
      },
      three: {
        open: {
          total: roundCurrency(totalSD),
          companyTariff: companyTariff,
          commission: calculatedCommission,
          totalWithCompanyTariffAndCommission: roundCurrency(totalPortal),
        },
        enclosed: {
          total: roundCurrency(totalSD + enclosedMarkup),
          companyTariff: companyTariff,
          commission: calculatedCommission,
          totalWithCompanyTariffAndCommission: roundCurrency(totalPortal + enclosedMarkup),
        },
        // Legacy fallback
        total: roundCurrency(totalSD),
        companyTariff: companyTariff,
        commission: calculatedCommission,
        totalWithCompanyTariffAndCommission: roundCurrency(totalPortal),
      },
      five: {
        open: {
          total: roundCurrency(totalSD),
          companyTariff: companyTariff,
          commission: calculatedCommission,
          totalWithCompanyTariffAndCommission: roundCurrency(totalPortal),
        },
        enclosed: {
          total: roundCurrency(totalSD + enclosedMarkup),
          companyTariff: companyTariff,
          commission: calculatedCommission,
          totalWithCompanyTariffAndCommission: roundCurrency(totalPortal + enclosedMarkup),
        },
        // Legacy fallback
        total: roundCurrency(totalSD),
        companyTariff: companyTariff,
        commission: calculatedCommission,
        totalWithCompanyTariffAndCommission: roundCurrency(totalPortal),
      },
      seven: {
        open: {
          total: roundCurrency(totalSD),
          companyTariff: companyTariff,
          commission: calculatedCommission,
          totalWithCompanyTariffAndCommission: roundCurrency(totalPortal),
        },
        enclosed: {
          total: roundCurrency(totalSD + enclosedMarkup),
          companyTariff: companyTariff,
          commission: calculatedCommission,
          totalWithCompanyTariffAndCommission: roundCurrency(totalPortal + enclosedMarkup),
        },
        // Legacy fallback
        total: roundCurrency(totalSD),
        companyTariff: companyTariff,
        commission: calculatedCommission,
        totalWithCompanyTariffAndCommission: roundCurrency(totalPortal),
      },
    },
  };
};
