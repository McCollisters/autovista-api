import { logger } from "@/core/logger";
import { IOrder } from "@/_global/models";
import { authenticateSuperDispatch } from "@/_global/integrations/authenticateSuperDispatch";
import { mapPricingClassToSuperDispatchVehicleType } from "@/order/integrations/mapPricingClassToSuperDispatchVehicleType";
import {
  matchSuperDispatchVehicles,
  collectUnmatchedSdVehicles,
} from "@/order/integrations/matchSuperDispatchVehicles";

export const updateOrderTariffsInSuper = async (
  order: IOrder,
): Promise<any> => {
  if (!order.tms?.guid) {
    throw new Error(`Order ${order.refId} does not have a Super Dispatch GUID`);
  }

  const token = await authenticateSuperDispatch();
  const apiUrl = "https://api.shipper.superdispatch.com/v1/public";

  const getOrderResponse = await fetch(`${apiUrl}/orders/${order.tms.guid}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!getOrderResponse.ok) {
    const errorText = await getOrderResponse.text();
    logger.error("Super Dispatch GET request error:", {
      status: getOrderResponse.status,
      statusText: getOrderResponse.statusText,
      error: errorText,
      orderRefId: order.refId,
      superDispatchGuid: order.tms.guid,
    });
    throw new Error(
      `Super Dispatch GET API error: ${getOrderResponse.status} ${getOrderResponse.statusText}`,
    );
  }

  const getOrderResult = await getOrderResponse.json();
  const existingOrder = getOrderResult?.data?.object;
  const sdVehicles = Array.isArray(existingOrder?.vehicles)
    ? existingOrder.vehicles
    : [];

  // Match each local vehicle to at most one SD vehicle so the PATCH can never
  // emit two entries that share the same SD vehicle guid (which SD collapses
  // into a single vehicle, dropping the extras).
  const matchedSdVehicles = matchSuperDispatchVehicles(
    sdVehicles,
    order.vehicles || [],
  );

  const updatedVehicles = (order.vehicles || []).map((vehicle, index) => {
    const sdVehicle = matchedSdVehicles[index] || {};
    const totalValue = Number(vehicle?.pricing?.total);
    const tariff = Number.isFinite(totalValue) ? totalValue : 0;
    const type = mapPricingClassToSuperDispatchVehicleType(
      vehicle.pricingClass,
    );
    const isInoperable = Boolean(vehicle.isInoperable === true);

    return {
      ...sdVehicle,
      tariff,
      type,
      is_inoperable: isInoperable,
    };
  });

  // Super Dispatch PATCH replaces the whole vehicles array (RFC 7396 merge
  // patch), so any SD vehicle we omit is deleted. Preserve SD vehicles we
  // couldn't match to keep the local list from ever truncating SD.
  const preservedSdVehicles = collectUnmatchedSdVehicles(
    sdVehicles,
    matchedSdVehicles,
  ).map((sdVehicle: any) => ({ ...sdVehicle }));

  const vehiclesPayload = [...updatedVehicles, ...preservedSdVehicles];

  if (preservedSdVehicles.length > 0) {
    logger.warn(
      "Preserving unmatched Super Dispatch vehicles to avoid deletion on tariff update",
      {
        orderRefId: order.refId,
        superDispatchGuid: order.tms.guid,
        localVehicleCount: (order.vehicles || []).length,
        sdVehicleCount: sdVehicles.length,
        preservedCount: preservedSdVehicles.length,
      },
    );
  }

  const patchOrderResponse = await fetch(`${apiUrl}/orders/${order.tms.guid}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/merge-patch+json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ vehicles: vehiclesPayload }),
  });

  if (!patchOrderResponse.ok) {
    const errorText = await patchOrderResponse.text();
    logger.error("Super Dispatch PATCH request error:", {
      status: patchOrderResponse.status,
      statusText: patchOrderResponse.statusText,
      error: errorText,
      orderRefId: order.refId,
      superDispatchGuid: order.tms.guid,
    });
    throw new Error(
      `Super Dispatch PATCH API error: ${patchOrderResponse.status} ${patchOrderResponse.statusText}`,
    );
  }

  return patchOrderResponse.json();
};
