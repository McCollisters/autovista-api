/**
 * Update Super Dispatch Order with Complete Details
 *
 * This service updates a partial order in Super Dispatch TMS with full order details.
 * Used when a carrier accepts an order that was initially sent as partial.
 */

import { logger } from "@/core/logger";
import { IOrder } from "@/_global/models";
import { authenticateSuperDispatch } from "@/_global/integrations/authenticateSuperDispatch";
import { format } from "date-fns";

/**
 * Update partial order in Super Dispatch with complete order details
 */
export const updateSuperWithCompleteOrder = async (
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

    // Populate portal if not already populated
    let portal = order.portalId;
    if (typeof portal === "object" && portal !== null) {
      // Already populated
    } else {
      const { Portal } = await import("@/_global/models");
      portal = await Portal.findById(order.portalId);
    }

    if (!portal) {
      throw new Error(`Order ${order.refId} has no associated portal`);
    }

    // First, fetch the existing order from Super Dispatch to preserve existing data
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
    if (getOrderResult.data?.error_id) {
      logger.error("Super Dispatch GET validation error:", {
        errorId: getOrderResult.data.error_id,
        message: getOrderResult.data.message,
        orderRefId: order.refId,
        superDispatchGuid,
      });
      throw new Error(
        `Super Dispatch GET validation error: ${getOrderResult.data.message}`,
      );
    }

    const existingOrder = getOrderResult.data?.object;
    if (!existingOrder) {
      throw new Error("Invalid response from Super Dispatch API");
    }

    const sdVehicles = existingOrder.vehicles || [];

    // Helper function to create a key from make and model
    const getMakeModelKey = (make: string, model: string) => {
      const makeStr = (make || "").toLowerCase().trim();
      const modelStr = (model || "").toLowerCase().trim();
      return `${makeStr}::${modelStr}`;
    };

    // Build vehicle data with complete details
    // Start with existing Super Dispatch vehicle to preserve all fields (including carrier price)
    const vehicleData = order.vehicles.map((vehicle, index) => {
      // Determine if vehicle is inoperable
      let inoperable = false;
      if (
        vehicle.isInoperable === true ||
        (vehicle as any).operableBool === false ||
        (vehicle as any).operable === false ||
        (vehicle as any).operable === "false" ||
        (vehicle as any).operable === "No"
      ) {
        inoperable = true;
      }

      // Format vehicle type
      let type = vehicle.pricingClass?.toLowerCase() || "other";

      if (type === "pick up 4 doors") {
        type = "4_door_pickup";
      }

      if (type === "pick up 2 doors") {
        type = "2_door_pickup";
      }

      // Get corresponding vehicle from Super Dispatch by index
      const sdVehicle = sdVehicles[index] || {}; // Use empty object if no match

      // Start with the existing Super Dispatch vehicle object to preserve all its fields
      const vehicleObj: any = { ...sdVehicle };

      // Override/set fields from the local order, preserving Super Dispatch values if local is missing
      vehicleObj.vin =
        vehicle.vin || sdVehicle.vin || null;
      vehicleObj.year =
        (vehicle.year ? parseInt(vehicle.year) : undefined) ||
        (sdVehicle.year ? parseInt(sdVehicle.year) : undefined) ||
        null;
      vehicleObj.make = vehicle.make;
      vehicleObj.model = vehicle.model;
      vehicleObj.is_inoperable = inoperable;
      vehicleObj.type = type;

      // Always include tariff - use existing Super Dispatch value if it exists (preserves carrier price),
      // otherwise use local value
      vehicleObj.tariff =
        sdVehicle.tariff !== undefined && sdVehicle.tariff !== null
          ? sdVehicle.tariff
          : vehicle.pricing?.totalWithCompanyTariffAndCommission ||
            vehicle.pricing?.total ||
            (vehicle as any).tariff ||
            0;

      return vehicleObj;
    });

    // Email validation function
    const isValidEmail = (email: string | undefined | null): boolean => {
      if (!email || typeof email !== "string") return false;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email.trim());
    };

    // Determine portal email
    let portalEmail = "autologistics@mccollisters.com"; // Default
    if (
      (portal as any).contact?.email &&
      isValidEmail((portal as any).contact.email)
    ) {
      portalEmail = (portal as any).contact.email.trim();
    } else if (
      (portal as any).notificationEmail &&
      isValidEmail((portal as any).notificationEmail)
    ) {
      portalEmail = (portal as any).notificationEmail.trim();
    }

    // Format dates
    const pickupStartDate = order.schedule.pickupEstimated[0]
      ? format(new Date(order.schedule.pickupEstimated[0]), "yyyy-MM-dd")
      : format(new Date(order.schedule.pickupSelected), "yyyy-MM-dd");

    const pickupEndDate = order.schedule.pickupEstimated[1]
      ? format(new Date(order.schedule.pickupEstimated[1]), "yyyy-MM-dd")
      : pickupStartDate;

    const deliveryStartDate = order.schedule.deliveryEstimated[0]
      ? format(new Date(order.schedule.deliveryEstimated[0]), "yyyy-MM-dd")
      : pickupStartDate;

    const deliveryEndDate = order.schedule.deliveryEstimated[1]
      ? format(new Date(order.schedule.deliveryEstimated[1]), "yyyy-MM-dd")
      : deliveryStartDate;

    // Check if instructions were manually updated in Super Dispatch
    // Only remove the default partial order instruction, preserve any custom instructions
    const defaultPartialInstruction =
      "Full order details will be released upon carrier approval by our office within 1 business day";
    let instructionsToUse: string | null = null;
    if (
      existingOrder.instructions &&
      existingOrder.instructions !== defaultPartialInstruction
    ) {
      // Preserve manually updated instructions
      instructionsToUse = existingOrder.instructions;
    }
    // If instructions match the default partial message or are null, set to null to remove it

    // Build complete order details
    const completeOrderDetails = {
      number: order.refId.toString(),
      purchase_order_number: order.reg || null,
      portalNotificationEmail:
        (portal as any).notificationEmail || portalEmail,
      // Remove default partial order instruction, but preserve manually updated instructions
      instructions: instructionsToUse,
      payment: {
        method: "other",
        terms: "other",
      },
      customer: {
        name: (portal as any).companyName || null,
        address: (portal as any).address?.address || null,
        city: (portal as any).address?.city || null,
        state: (portal as any).address?.state || null,
        zip: (portal as any).address?.zip || null,
        contact_name: (portal as any).contact?.name || null,
        contact_mobile_phone: (portal as any).contact?.phone || null,
        contact_email: portalEmail,
        business_type: "BUSINESS",
        phone: (portal as any).contact?.phone || null,
      },
      pickup: {
        date_type: "estimated",
        first_available_pickup_date: pickupStartDate,
        scheduled_at: pickupStartDate,
        scheduled_ends_at: pickupEndDate,
        latitude: parseFloat(order.origin.latitude) || null,
        longitude: parseFloat(order.origin.longitude) || null,
        notes: order.origin.notes || null,
        venue: {
          address: order.origin.address?.address || null,
          city: order.origin.address?.city || null,
          state: order.origin.address?.state || null,
          zip: order.origin.address?.zip || null,
          name: order.origin.contact?.name || null,
          contact_name: order.origin.contact?.name || null,
          contact_email: "autologistics@mccollisters.com",
          contact_phone: "888-819-0594",
          contact_mobile_phone: "888-819-0594",
        },
      },
      delivery: {
        date_type: "estimated",
        scheduled_at: deliveryStartDate,
        scheduled_ends_at: deliveryEndDate,
        latitude: parseFloat(order.destination.latitude) || null,
        longitude: parseFloat(order.destination.longitude) || null,
        notes: order.destination.notes || null,
        venue: {
          address: order.destination.address?.address || null,
          city: order.destination.address?.city || null,
          state: order.destination.address?.state || null,
          zip: order.destination.address?.zip || null,
          name: order.destination.contact?.name || null,
          contact_name: order.destination.contact?.name || null,
          contact_email: "autologistics@mccollisters.com",
          contact_phone: "888-819-0594",
          contact_mobile_phone: "888-819-0594",
        },
      },
      transport_type: order.transportType.toUpperCase(),
      vehicles: vehicleData,
    };

    // Make PATCH request to Super Dispatch
    // Super Dispatch requires application/merge-patch+json for PATCH requests
    const response = await fetch(`${apiUrl}/orders/${superDispatchGuid}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/merge-patch+json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(completeOrderDetails),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Super Dispatch PATCH API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        orderRefId: order.refId,
        superDispatchGuid,
      });
      throw new Error(
        `Super Dispatch API error: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();

    // Handle Super Dispatch validation errors
    if (result.data?.error_id) {
      logger.error("Super Dispatch PATCH validation error:", {
        errorId: result.data.error_id,
        message: result.data.message,
        orderRefId: order.refId,
        superDispatchGuid,
      });
      throw new Error(
        `Super Dispatch validation error: ${result.data.message}`,
      );
    }

    // Return the order object from response
    if (result.data?.object) {
      logger.info("Successfully updated Super Dispatch order with complete details", {
        orderRefId: order.refId,
        superDispatchGuid,
      });
      return result.data.object;
    }

    // Fallback: return the full response if structure is different
    logger.warn("Unexpected Super Dispatch PATCH response structure", {
      orderRefId: order.refId,
      superDispatchGuid,
      response: result,
    });
    return result.data || result;
  } catch (error) {
    logger.error("Error updating Super Dispatch order with complete details:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orderRefId: order.refId,
    });
    throw error;
  }
};

