import { IVehicle } from "../../_global/interfaces";
import { authenticateSuperDispatch } from "../../_global/integrations/authenticateSuperDispatch";

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

  const superDispatchToken = await authenticateSuperDispatch();
  const url = new URL(
    `https://api.shipper.superdispatch.com/v1/public/prices/price_prediction/${vehicle.class}`,
  );
  url.searchParams.append("pickup_address", origin.replace(/\d+/g, "").trim());
  url.searchParams.append(
    "delivery_address",
    destination.replace(/\d+/g, "").trim(),
  );

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${superDispatchToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    return json.data?.object;
  } catch (error) {
    console.error(
      "Error fetching price prediction from Super Dispatch:",
      error,
    );
    throw error;
  }
};
