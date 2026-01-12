/**
 * Save Super Dispatch updates to database
 *
 * Fetches full order details from Super Dispatch API and updates the local database.
 * This ensures comprehensive syncing of order data including pricing, vehicles, and dates.
 */

import { IOrder, Order } from "@/_global/models";
import { logger } from "@/core/logger";
import { authenticateSuperDispatch } from "@/_global/integrations/authenticateSuperDispatch";
import { updateOrderFromSD } from "./updateOrderFromSD";

/**
 * Fetch order from Super Dispatch and update database
 * @param order - The order to update
 */
export const saveSDUpdatesToDB = async (order: IOrder): Promise<void> => {
  try {
    if (!order.tms?.guid) {
      logger.warn(
        `Order ${order.refId} has no Super Dispatch GUID, skipping update`,
      );
      return;
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
      return;
    }

    const responseData = await response.json();
    const superDispatchOrder = responseData.data?.object;

    if (!superDispatchOrder) {
      logger.warn("Super Dispatch returned no order data", {
        orderRefId: order.refId,
        tmsGuid: order.tms.guid,
      });
      return;
    }

    // Store original schedule dates to detect changes
    const originalPickupDate = order.schedule?.pickupEstimated?.[0]
      ? new Date(order.schedule.pickupEstimated[0]).toISOString()
      : null;
    const originalDeliveryDate = order.schedule?.deliveryEstimated?.[0]
      ? new Date(order.schedule.deliveryEstimated[0]).toISOString()
      : null;

    // Update order from Super Dispatch data (always update, regardless of status)
    const updatedOrder = await updateOrderFromSD(superDispatchOrder, order);

    if (!updatedOrder) {
      logger.warn("updateOrderFromSD returned null, skipping database update", {
        orderRefId: order.refId,
        tmsGuid: order.tms.guid,
      });
      return;
    }

    // Detect schedule changes before updating
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

    // Update the order in database
    const savedOrder = await Order.findByIdAndUpdate(order._id, updatedOrder, {
      new: true,
    });

    if (!savedOrder) {
      logger.warn("Failed to save updated order", {
        orderRefId: order.refId,
        tmsGuid: order.tms.guid,
      });
      return;
    }

    logger.info("Successfully updated order from Super Dispatch", {
      orderRefId: order.refId,
      tmsGuid: order.tms.guid,
      pickupDatesChanged,
      deliveryDatesChanged,
    });

    // Notify Acertus of schedule updates (for Autonation portal orders)
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
  } catch (error) {
    logger.error("Error in saveSDUpdatesToDB:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orderRefId: order.refId,
      tmsGuid: order.tms?.guid,
    });
  }
};
