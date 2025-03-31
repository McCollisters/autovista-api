import { isCanadianPostcode } from "../utils/isCanadianPostcode";
import { getCityStateFromZip } from "../../_global/utils/zip";

export const validateLocation = async (location: string): Promise<{location: string, error: string | null}> => {

    let error: string | null = null;

    if (isCanadianPostcode(location)) {
        error = "Please contact us for quotes with pick up or delivery to Canada.";
    }

    if (location.includes(", HI") || location.includes(", AK")) {
        error = "For quotes involving transport to or from AK (Alaska) or HI (Hawaii) please contact us directly for a specialized quote at (888) 819-0594 or email us at autologistics@mccollisters.com.  Thank you!";
    }

    const numbersOnly = /^\d+$/.test(location);
    if (numbersOnly)  {
        if (location.toString().length !== 5) {
            error = "Invalid zip code";
        } else {
            location = await getCityStateFromZip(location) || "Missing";
        }
    }

    return { location, error };
};
