import { logger } from "@/core/logger";
import { IOrder } from "@/_global/models";
import { authenticateSuperDispatch } from "@/_global/integrations/authenticateSuperDispatch";

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

  const getMakeModelKey = (make: string, model: string) => {
    const makeStr = (make || "").toLowerCase().trim();
    const modelStr = (model || "").toLowerCase().trim();
    return `${makeStr}::${modelStr}`;
  };

  const sdVehiclesByMakeModel = new Map<string, any>();
  sdVehicles.forEach((sdVehicle: any) => {
    const key = getMakeModelKey(sdVehicle.make, sdVehicle.model);
    if (key) {
      sdVehiclesByMakeModel.set(key, sdVehicle);
    }
  });

  const updatedVehicles = (order.vehicles || []).map((vehicle, index) => {
    const key = getMakeModelKey(
      String(vehicle.make || ""),
      String(vehicle.model || ""),
    );
    const sdVehicle =
      (key && sdVehiclesByMakeModel.get(key)) || sdVehicles[index] || {};
    const totalValue = Number(vehicle?.pricing?.totalWithCompanyTariffAndCommission);
    const fallbackValue = Number(vehicle?.pricing?.total);
    const tariff = Number.isFinite(totalValue)
      ? totalValue
      : Number.isFinite(fallbackValue)
        ? fallbackValue
        : 0;

    return {
      ...sdVehicle,
      tariff,
    };
  });

  const patchOrderResponse = await fetch(`${apiUrl}/orders/${order.tms.guid}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/merge-patch+json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ vehicles: updatedVehicles }),
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
