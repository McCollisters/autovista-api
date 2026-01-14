import { IVehicle } from "../../_global/interfaces";

export const getTMSBaseRate = async (
  vehicle: Partial<IVehicle>,
  origin: string,
  destination: string,
) => {
  // Addresses current Super Dispatch bug with Midland quotes
  if (origin === "Midland, MI") {
    origin = "Freeland, MI";
  }

  if (destination === "Midland, MI") {
    destination = "Freeland, MI";
  }

  const originParts = origin.split(",").map((part) => part.trim());
  const destinationParts = destination.split(",").map((part) => part.trim());
  
  const originCity = originParts[0];
  const originState = originParts[1];
  const destinationCity = destinationParts[0];
  const destinationState = destinationParts[1];

  // Validate that we have both city and state for both locations
  if (!originCity || !originState) {
    throw new Error(`Invalid origin format: "${origin}". Expected format: "City, State"`);
  }
  
  if (!destinationCity || !destinationState) {
    throw new Error(`Invalid destination format: "${destination}". Expected format: "City, State"`);
  }

  const url = new URL(
    `https://pricing-insights.superdispatch.com/api/v1/recommended-price`,
  );

  try {
    let vehicleDetails = {};

    const vehiclesFormatted = [
      {
        type: vehicle.pricingClass || "sedan",
        is_inoperable: vehicle.isInoperable || false,
        make: vehicle.make || "",
        model: vehicle.model || "",
      },
    ];

    const requestBody = {
      pickup: {
        city: originCity,
        state: originState,
      },
      delivery: {
        city: destinationCity,
        state: destinationState,
      },
      trailer_type: "open",
      vehicles: vehiclesFormatted,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SD_PRICING_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // Try to get error details from response body
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorBody = await response.text();
        if (errorBody) {
          errorMessage += ` - ${errorBody}`;
        }
      } catch (e) {
        // If we can't read the body, just use the status
      }
      throw new Error(errorMessage);
    }

    const body = await response.json();

    if (body && body.data?.price) {
      return { quote: body.data.price, vehicleDetails };
    } else {
      throw new Error(
        "There was an error with the price prediction. Please contact us for assistance.",
      );
    }
  } catch (error) {
    throw error;
  }
};
