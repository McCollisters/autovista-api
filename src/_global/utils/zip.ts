import { USState } from "../../_global/enums";

export function isValidZipCode(zipCode: string): boolean {
    const zipCodePattern = /^\d{5}$/;
    return zipCodePattern.test(zipCode);
  }
  
export function getZipFromString(str: string): string[] | null {
    return str.match(/\d+/g) || null;
}

export function removeZipFromString(str: string): string {
    return str.replace(/\d/g, "");
}

export async function getCityStateFromZip(zipCode: string): Promise<string | null> {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${zipCode}.json?country=us&access_token=${process.env.MAPBOX_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
  
      if (!data.features || data.features.length === 0) return null;
  
      let city: string | undefined;
      let state: string | undefined;
  
      data.features[0]?.context.forEach((contextItem: any) => {
        if (contextItem.id.startsWith("place")) {
          city = contextItem.text;
        }
        if (contextItem.id.startsWith("region")) {
          state = contextItem.text;
        }
      });
      
      const stateAbbrev = state ? USState[state as keyof typeof USState] : undefined;
      return city && stateAbbrev ? `${city}, ${stateAbbrev}` : null;

    } catch (error) {
      console.error("Error fetching location:", error);
      return null;
    }
  }
  