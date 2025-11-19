/**
 * Get JK Base Rate from Custom Rates Mileage Structure
 * 
 * JK Moving uses a specific mileage-based rate structure with keys like "1-250", "251-500", etc.
 * This function extracts the base rate based on miles.
 */

import { IPortal } from "@/_global/models";

export const getJKBaseRate = (miles: number, portal: IPortal): number => {
  try {
    // Check if portal has the old mileage structure (for JK)
    const portalAny = portal as any;
    const mileageRates = portalAny.customRates?.mileage || {};
    
    // If mileage structure exists, use it directly
    if (Object.keys(mileageRates).length > 0) {
      let baseQuote: number | undefined;
      
      switch (true) {
        case miles > 3500:
          baseQuote = mileageRates["3501"];
          break;
        case miles > 3000 && miles < 3501:
          baseQuote = mileageRates["3001-3500"];
          break;
        case miles > 2500 && miles < 3001:
          baseQuote = mileageRates["2501-3000"];
          break;
        case miles > 2000 && miles < 2501:
          baseQuote = mileageRates["2001-2500"];
          break;
        case miles > 1750 && miles < 2001:
          baseQuote = mileageRates["1751-2000"];
          break;
        case miles > 1500 && miles < 1751:
          baseQuote = mileageRates["1501-1750"];
          break;
        case miles > 1250 && miles < 1501:
          baseQuote = mileageRates["1251-1500"];
          break;
        case miles > 1000 && miles < 1251:
          baseQuote = mileageRates["1001-1250"];
          break;
        case miles > 750 && miles < 1001:
          baseQuote = mileageRates["751-1000"];
          break;
        case miles > 500 && miles < 751:
          baseQuote = mileageRates["501-750"];
          break;
        case miles > 250 && miles < 501:
          baseQuote = mileageRates["251-500"] || mileageRates["1-500"];
          break;
        default:
          baseQuote = mileageRates["1-250"];
      }
      
      return baseQuote || 0;
    }
    
    // Fallback: try to reconstruct from customRates array format
    // This would require matching the miles to the range
    return 0;
  } catch (error) {
    console.error("Error getting JK base rate:", error);
    return 0;
  }
};

