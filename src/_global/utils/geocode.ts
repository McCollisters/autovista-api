/**
 * Geocoding Utility
 *
 * This utility provides geocoding functionality using Mapbox API
 */

export interface GeocodeResult {
  latitude: string;
  longitude: string;
}

export const geocode = async (
  address: string,
): Promise<GeocodeResult | null> => {
  try {
    const accessToken = process.env.MAPBOX_API_KEY;
    if (!accessToken) {
      throw new Error("MAPBOX_API_KEY environment variable is required");
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${accessToken}&limit=1`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return {
        latitude: latitude.toString(),
        longitude: longitude.toString(),
      };
    }

    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    throw error;
  }
};

