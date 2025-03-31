export const getMiles = async ( origin: [number, number],
    destination: [number, number]): Promise<number | null> => {

    const accessToken = process.env.MAPBOX_API_KEY;

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.join(",")};${destination.join(",")}?access_token=${accessToken}&geometries=geojson`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        let miles = null;

        if (data.routes && data.routes.length > 0) {
            miles = Math.round(data.routes[0].distance / 1609.34); 
        } 

        return miles;
        
    } catch (error) {
        console.error("Error fetching Mapbox mileage:", error);
        return null;
    }

};
