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
      logger.warn(`Order ${order.refId} has no Super Dispatch GUID, skipping update`);
      return;
    }

    const token = await authenticateSuperDispatch();
    const apiUrl = process.env.SUPERDISPATCH_API_URL || "https://api.shipper.superdispatch.com/v1/public";

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

    // Don't update if order status is "new" (not yet accepted)
    if (superDispatchOrder.status === "new") {
      logger.info("Order status is 'new', skipping update", {
        orderRefId: order.refId,
        tmsGuid: order.tms.guid,
      });
      return;
    }

    // Update order from Super Dispatch data
    const updatedOrder = await updateOrderFromSD(superDispatchOrder, order);

    if (!updatedOrder) {
      logger.warn("updateOrderFromSD returned null, skipping database update", {
        orderRefId: order.refId,
        tmsGuid: order.tms.guid,
      });
      return;
    }

    // Update the order in database
    await Order.findByIdAndUpdate(order._id, updatedOrder, {
      new: true,
    });

    logger.info("Successfully updated order from Super Dispatch", {
      orderRefId: order.refId,
      tmsGuid: order.tms.guid,
    });
  } catch (error) {
    logger.error("Error in saveSDUpdatesToDB:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orderRefId: order.refId,
      tmsGuid: order.tms?.guid,
    });
  }
};

