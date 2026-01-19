/**
 * Update Super Dispatch Order with Partial Details
 *
 * This service updates an existing order in Super Dispatch TMS to partial/redacted status.
 * VINs are removed and addresses are redacted for privacy protection.
 */

import { logger } from "@/core/logger";
import { IOrder } from "@/_global/models";
import { authenticateSuperDispatch } from "@/_global/integrations/authenticateSuperDispatch";

/**
 * Update existing order in Super Dispatch with partial/redacted details
 * Removes VINs and redacts addresses
 */
export const updateSuperWithPartialOrder = async (
  order: IOrder,
): Promise<any> => {
  try {
    if (!order.tms?.guid) {
      throw new Error(
        `Order ${order.refId} does not have a Super Dispatch GUID`,
      );
    }

    const superDispatchGuid = order.tms.guid;

    // Authenticate with Super Dispatch
    const token = await authenticateSuperDispatch();

    // Fetch the existing order from Super Dispatch
    const apiUrl = "https://api.shipper.superdispatch.com/v1/public";
    const getOrderResponse = await fetch(
      `${apiUrl}/orders/${superDispatchGuid}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!getOrderResponse.ok) {
      const errorText = await getOrderResponse.text();
      logger.error("Super Dispatch GET request error:", {
        status: getOrderResponse.status,
        statusText: getOrderResponse.statusText,
        error: errorText,
        orderRefId: order.refId,
        superDispatchGuid,
      });
      throw new Error(
        `Super Dispatch GET API error: ${getOrderResponse.status} ${getOrderResponse.statusText}`,
      );
    }

    const getOrderResult = await getOrderResponse.json();

    if (!getOrderResult || !getOrderResult.data) {
      logger.error("Super Dispatch GET unexpected response:", {
        orderRefId: order.refId,
        superDispatchGuid,
        response: getOrderResult,
      });
      throw new Error("Invalid response from Super Dispatch API");
    }

    if (getOrderResult.data.error_id) {
      logger.error("Super Dispatch GET error:", {
        errorId: getOrderResult.data.error_id,
        message: getOrderResult.data.message,
        orderRefId: order.refId,
        superDispatchGuid,
      });
      throw new Error(getOrderResult.data.message);
    }

    const existingOrder = getOrderResult.data.object;

    const normalizeZip = (value?: string | number | null) => {
      if (!value && value !== 0) {
        return "";
      }
      const digits = String(value).match(/\d{5}/)?.[0] || "";
      return digits;
    };

    // Build partial order details - redact addresses and remove VINs
    const partialOrderDetails = {
      number: existingOrder.number,
      purchase_order_number: existingOrder.purchase_order_number,
      instructions:
        "Full order details will be released upon carrier approval by our office within 1 business day",
      payment: {
        method: "other",
        terms: "other",
      },
      customer: {
        name: existingOrder.customer?.name || null,
        address: existingOrder.customer?.address || null,
        city: existingOrder.customer?.city || null,
        state: existingOrder.customer?.state || null,
        zip: existingOrder.customer?.zip || null,
      },
      pickup: {
        date_type: "estimated",
        first_available_pickup_date:
          existingOrder.pickup?.first_available_pickup_date,
        scheduled_at: existingOrder.pickup?.scheduled_at,
        scheduled_ends_at: existingOrder.pickup?.scheduled_ends_at,
        notes: order.origin?.notes || null,
        venue: {
          name: "Address Withheld",
          address: "123 Example St. ADDRESS WITHHELD",
          city: existingOrder.pickup?.venue?.city,
          state: existingOrder.pickup?.venue?.state,
          zip: normalizeZip(existingOrder.pickup?.venue?.zip),
        },
      },
      delivery: {
        date_type: "estimated",
        scheduled_at: existingOrder.delivery?.scheduled_at,
        scheduled_ends_at: existingOrder.delivery?.scheduled_ends_at,
        notes: order.destination?.notes || null,
        venue: {
          name: "Address Withheld",
          address: "123 Example St. ADDRESS WITHHELD",
          city: existingOrder.delivery?.venue?.city,
          state: existingOrder.delivery?.venue?.state,
          zip: normalizeZip(existingOrder.delivery?.venue?.zip),
        },
      },
      transport_type: existingOrder.transport_type,
      // Remove VINs from vehicles for partial order (privacy protection)
      // Keep all other vehicle details but set VIN to null
      vehicles: existingOrder.vehicles
        ? existingOrder.vehicles.map((vehicle: any) => ({
            ...vehicle,
            vin: null, // Remove VIN for partial order
          }))
        : existingOrder.vehicles,
    };

    // Super Dispatch requires application/merge-patch+json for PATCH requests
    const patchOrderResponse = await fetch(
      `${apiUrl}/orders/${superDispatchGuid}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/merge-patch+json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(partialOrderDetails),
      },
    );

    if (!patchOrderResponse.ok) {
      const errorText = await patchOrderResponse.text();
      logger.error("Super Dispatch PATCH request error:", {
        status: patchOrderResponse.status,
        statusText: patchOrderResponse.statusText,
        error: errorText,
        orderRefId: order.refId,
        superDispatchGuid,
      });
      throw new Error(
        `Super Dispatch PATCH API error: ${patchOrderResponse.status} ${patchOrderResponse.statusText}`,
      );
    }

    const patchResult = await patchOrderResponse.json();

    if (!patchResult || !patchResult.data) {
      logger.error("Super Dispatch PATCH unexpected response:", {
        orderRefId: order.refId,
        superDispatchGuid,
        response: patchResult,
      });
      throw new Error("Invalid response from Super Dispatch API");
    }

    if (patchResult.data.error_id) {
      logger.error("Super Dispatch PATCH validation error:", {
        errorId: patchResult.data.error_id,
        message: patchResult.data.message,
        orderRefId: order.refId,
        superDispatchGuid,
      });
      throw new Error(
        `Super Dispatch validation error: ${patchResult.data.message}`,
      );
    }

    logger.info("Successfully updated Super Dispatch order with partial details", {
      orderRefId: order.refId,
      superDispatchGuid,
    });

    return patchResult.data.object;
  } catch (error) {
    logger.error("Error updating Super Dispatch order with partial details:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orderRefId: order.refId,
    });
    throw error;
  }
};

