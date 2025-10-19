export const getMiles = async (
  origin: [number, number],
  destination: [number, number],
): Promise<number | null> => {
  const accessToken = process.env.MAPBOX_API_KEY;

  if (!accessToken) {
    return null;
  }

  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.join(",")};${destination.join(",")}?access_token=${accessToken}&geometries=geojson`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const miles = Math.round(data.routes[0].distance / 1609.34);
      return miles;
    }

    return null;
  } catch (error) {
    console.error("Error fetching Mapbox mileage:", error);
    return null;
  }
};
