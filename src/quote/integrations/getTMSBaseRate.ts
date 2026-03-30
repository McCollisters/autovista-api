import { IVehicle } from "../../_global/interfaces";

const NO_ROUTE_AVAILABLE_TYPE = "NO_ROUTE_AVAILABLE";

const formatNoRouteAvailableMessage = (
  origin: string,
  destination: string,
): string =>
  `Unable to generate an automatic quote from ${origin} to ${destination} because no drivable route was found between the locations. Verify the pickup and delivery locations (including ZIP/state) or quote this shipment manually for special routing.`;

const parseErrorBody = (
  errorBody: string,
): {
  type?: string;
  message?: string;
} | null => {
  try {
    const parsed = JSON.parse(errorBody);
    return {
      type: parsed?.data?.type,
      message: parsed?.data?.message,
    };
  } catch (_error) {
    return null;
  }
};

export const getTMSBaseRate = async (
  vehicle: Partial<IVehicle>,
  origin: string,
  destination: string,
) => {
  origin = origin.trim();
  destination = destination.trim();

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
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch (_error) {
        // If we cannot read the body, fall back to status-only handling below.
      }

      const parsedError = errorBody ? parseErrorBody(errorBody) : null;
      if (
        response.status === 400 &&
        parsedError?.type === NO_ROUTE_AVAILABLE_TYPE
      ) {
        throw new Error(formatNoRouteAvailableMessage(origin, destination));
      }

      // Try to provide a concise provider message before falling back to raw body.
      let errorMessage = `HTTP error! status: ${response.status}`;
      if (parsedError?.message) {
        errorMessage += ` - ${parsedError.message}`;
      } else if (errorBody) {
        errorMessage += ` - ${errorBody}`;
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
