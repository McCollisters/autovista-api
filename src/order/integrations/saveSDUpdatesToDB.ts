/**
 * Save Super Dispatch updates to database
 *
 * Fetches full order details from Super Dispatch API and updates the local database.
 * This ensures comprehensive syncing of order data including pricing, vehicles, and dates.
 */

import { IOrder, Order } from "@/_global/models";
import { logger } from "@/core/logger";
import { authenticateSuperDispatch } from "@/_global/integrations/authenticateSuperDispatch";
import {
  updateOrderFromSD,
  updateOrderScheduleAndVehiclesFromSD,
} from "./updateOrderFromSD";

type SdSyncMode = "full" | "scheduleAndVehicles";

async function fetchSuperDispatchOrder(
  order: IOrder,
): Promise<Record<string, unknown> | null> {
  if (!order.tms?.guid) {
    logger.warn(
      `Order ${order.refId} has no Super Dispatch GUID, skipping update`,
    );
    return null;
  }

  const token = await authenticateSuperDispatch();
  const apiUrl =
    process.env.SUPERDISPATCH_API_URL ||
    "https://api.shipper.superdispatch.com/v1/public";

  const response = await fetch(`${apiUrl}/orders/${order.tms.guid}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    logger.error("Failed to fetch order from Super Dispatch", {
      orderRefId: order.refId,
      tmsGuid: order.tms.guid,
      status: response.status,
      statusText: response.statusText,
    });
    return null;
  }

  const responseData = await response.json();
  const superDispatchOrder = responseData.data?.object;

  if (!superDispatchOrder) {
    logger.warn("Super Dispatch returned no order data", {
      orderRefId: order.refId,
      tmsGuid: order.tms.guid,
    });
    return null;
  }

  return superDispatchOrder;
}

async function applySuperDispatchUpdateToDatabase(
  order: IOrder,
  superDispatchOrder: Record<string, unknown>,
  mode: SdSyncMode,
): Promise<void> {
  const originalPickupDate = order.schedule?.pickupEstimated?.[0]
    ? new Date(order.schedule.pickupEstimated[0]).toISOString()
    : null;
  const originalDeliveryDate = order.schedule?.deliveryEstimated?.[0]
    ? new Date(order.schedule.deliveryEstimated[0]).toISOString()
    : null;

  const updatedOrder =
    mode === "scheduleAndVehicles"
      ? await updateOrderScheduleAndVehiclesFromSD(
          superDispatchOrder as any,
          order,
        )
      : await updateOrderFromSD(superDispatchOrder as any, order);

  if (!updatedOrder) {
    logger.warn("Super Dispatch sync returned null, skipping database update", {
      orderRefId: order.refId,
      tmsGuid: order.tms?.guid,
      mode,
    });
    return;
  }

  const newPickupDate = updatedOrder.schedule?.pickupEstimated?.[0]
    ? new Date(updatedOrder.schedule.pickupEstimated[0]).toISOString()
    : null;
  const newDeliveryDate = updatedOrder.schedule?.deliveryEstimated?.[0]
    ? new Date(updatedOrder.schedule.deliveryEstimated[0]).toISOString()
    : null;

  const pickupDatesChanged =
    originalPickupDate !== newPickupDate &&
    (originalPickupDate !== null || newPickupDate !== null);
  const deliveryDatesChanged =
    originalDeliveryDate !== newDeliveryDate &&
    (originalDeliveryDate !== null || newDeliveryDate !== null);

  const savedOrder = await Order.findByIdAndUpdate(order._id, updatedOrder, {
    new: true,
  });

  if (!savedOrder) {
    logger.warn("Failed to save updated order", {
      orderRefId: order.refId,
      tmsGuid: order.tms?.guid,
      mode,
    });
    return;
  }

  logger.info("Successfully updated order from Super Dispatch", {
    orderRefId: order.refId,
    tmsGuid: order.tms?.guid,
    mode,
    pickupDatesChanged,
    deliveryDatesChanged,
  });

  if (pickupDatesChanged || deliveryDatesChanged) {
    try {
      const { notifyOrderScheduleUpdated } = await import(
        "@/order/integrations/acertusClient"
      );
      await notifyOrderScheduleUpdated(savedOrder, {
        pickupDatesChanged,
        deliveryDatesChanged,
      }).catch((error) => {
        logger.error("Failed to notify Acertus of schedule update", {
          orderId: savedOrder._id,
          refId: savedOrder.refId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } catch (importError) {
      logger.error("Failed to import Acertus client", {
        error:
          importError instanceof Error
            ? importError.message
            : String(importError),
      });
    }
  }
}

/**
 * Fetch order from Super Dispatch and update database (full sync).
 * Used when loading an order in the portal.
 */
export const saveSDUpdatesToDB = async (order: IOrder): Promise<void> => {
  try {
    const superDispatchOrder = await fetchSuperDispatchOrder(order);
    if (!superDispatchOrder) {
      return;
    }

    await applySuperDispatchUpdateToDatabase(order, superDispatchOrder, "full");
  } catch (error) {
    logger.error("Error in saveSDUpdatesToDB:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orderRefId: order.refId,
      tmsGuid: order.tms?.guid,
    });
  }
};

/**
 * Sync schedule dates and vehicles from Super Dispatch after a webhook.
 * Partial orders (`tmsPartialOrder`) use a lightweight sync that does not
 * touch addresses or order status; full orders receive a complete sync.
 */
export const syncOrderFromSdWebhook = async (order: IOrder): Promise<void> => {
  try {
    const superDispatchOrder = await fetchSuperDispatchOrder(order);
    if (!superDispatchOrder) {
      return;
    }

    const mode: SdSyncMode =
      order.tmsPartialOrder === true ? "scheduleAndVehicles" : "full";

    await applySuperDispatchUpdateToDatabase(order, superDispatchOrder, mode);
  } catch (error) {
    logger.error("Error in syncOrderFromSdWebhook:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orderRefId: order.refId,
      tmsGuid: order.tms?.guid,
    });
  }
};
