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

  const originCity = origin.split(",")[0];
  const destinationCity = destination.split(",")[0];
  const originState = origin.split(",")[1];
  const destinationState = destination.split(",")[1];

  const url = new URL(
    `https://pricing-insights.superdispatch.com/api/v1/recommended-price`,
  );

  try {
    let vehicleDetails = {};

    const vehiclesFormatted = [
      {
        type: vehicle.pricingClass || "sedan",
        is_inoperable: vehicle.isInoperable,
        make: vehicle.make,
        model: vehicle.model,
      },
    ];

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SD_PRICING_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
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
