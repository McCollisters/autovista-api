import { USState } from "../enums";

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

export async function getCityStateFromZip(zipCode: string): Promise<{ location: string | null, state: string | null}> {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${zipCode}.json?country=us&access_token=${process.env.MAPBOX_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
  
      if (!data.features || data.features.length === 0) return { location: null, state: null};
  
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
    
      return {
        location: `${city}, ${stateAbbrev}` || null,
        state: stateAbbrev || null
      }

    } catch (error) {
      console.error("Error fetching location:", error);
      return {
        location: null,
        state: null 
      }
    }
  }
  

const usStateAbbreviations = Object.values(USState).join("|");
const stateRegex = new RegExp(`,\\s?(${usStateAbbreviations})\\b`);

export function getStateAbbreviation(input: string): string | null {
    const match = input.match(stateRegex);
    return match ? match[1] : null;
}


export async function getCoordinates(location: string): Promise<[number, number] | null> {
  const accessToken = process.env.MAPBOX_API_KEY;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${accessToken}&limit=1`;

  try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.features && data.features.length > 0) {
          const [longitude, latitude] = data.features[0].center;
          return [longitude, latitude]; 
      } else {
          console.error("Location not found:", location);
      }
  } catch (error) {
      console.error("Error fetching coordinates:", error);
  }
  return null;
};