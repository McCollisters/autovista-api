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
  let error: string | null = null;
  let state: string | null = null;
  let locationString: string | null = null;

  if (isCanadianPostcode(location)) {
    error = "Please contact us for quotes with pick up or delivery to Canada.";
  }

  if (location.includes(", HI") || location.includes(", AK")) {
    error =
      "For quotes involving transport to or from AK (Alaska) or HI (Hawaii) please contact us directly for a specialized quote at (888) 819-0594 or email us at autologistics@mccollisters.com.  Thank you!";
  }

  const numbersOnly = /^\d+$/.test(location);
  if (numbersOnly) {
    if (location.toString().length !== 5) {
      error = "Invalid zip code";
    } else {
      const result = await getCityStateFromZip(location);
      locationString = result.location || null;
      state = result.state || null;

      console.log(result);
    }
  } else {
    state = getStateAbbreviation(location);
  }

  return { location: locationString, error, state };
};
