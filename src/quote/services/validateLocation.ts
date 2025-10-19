import { isCanadianPostcode } from "../utils/isCanadianPostcode";
import {
  getCityStateFromZip,
  getStateAbbreviation,
} from "../../_global/utils/location";

export const validateLocation = async (
  location: string,
): Promise<{
  state: string | null;
  location: string | null;
  error: string | null;
}> => {
  // Check for Canadian postcodes first
  if (isCanadianPostcode(location)) {
    return {
      state: null,
      location: null,
      error: "Please contact us for quotes with pick up or delivery to Canada.",
    };
  }

  // Check for Hawaii/Alaska locations
  if (location.includes(", HI") || location.includes(", AK")) {
    return {
      state: null,
      location: null,
      error:
        "For quotes involving transport to or from AK (Alaska) or HI (Hawaii) please contact us directly for a specialized quote at (888) 819-0594 or email us at autologistics@mccollisters.com.  Thank you!",
    };
  }

  const numbersOnly = /^\d+$/.test(location);
  if (numbersOnly) {
    if (location.toString().length !== 5) {
      return {
        state: null,
        location: null,
        error: "Invalid zip code",
      };
    }

    try {
      const result = await getCityStateFromZip(location);
      return {
        location: result.location || null,
        state: result.state || null,
        error: null,
      };
    } catch (error) {
      console.error("Error validating zip code:", error);
      return {
        state: null,
        location: null,
        error: "Error validating zip code",
      };
    }
  }

  // Handle non-zip code locations
  const state = getStateAbbreviation(location);
  return {
    location: null,
    state,
    error: null,
  };
};
