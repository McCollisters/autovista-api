export const getCoordinates = async (location: string): Promise<[number, number] | null> => {
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