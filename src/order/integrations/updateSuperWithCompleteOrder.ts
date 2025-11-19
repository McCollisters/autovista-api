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

    // Build vehicle data with complete details
    const vehicleData = order.vehicles.map((vehicle) => {
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

      // Get tariff from vehicle pricing
      // Note: For Super Dispatch, we need the tariff which is typically the total with company tariff
      // If not available, fall back to total pricing
      const tariff =
        vehicle.pricing?.totalWithCompanyTariffAndCommission ||
        vehicle.pricing?.total ||
        (vehicle as any).tariff ||
        0;

      return {
        tariff,
        vin: vehicle.vin || null,
        year: vehicle.year ? parseInt(vehicle.year) : undefined,
        make: vehicle.make,
        model: vehicle.model,
        is_inoperable: inoperable,
        type,
      };
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

    // Build complete order details
    const completeOrderDetails = {
      number: order.refId.toString(),
      purchase_order_number: order.reg || null,
      portalNotificationEmail:
        (portal as any).notificationEmail || portalEmail,
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

    // Make PUT request to Super Dispatch
    const apiUrl = "https://api.shipper.superdispatch.com/v1/public";
    const response = await fetch(`${apiUrl}/orders/${superDispatchGuid}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(completeOrderDetails),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Super Dispatch PUT API error:", {
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
      logger.error("Super Dispatch PUT validation error:", {
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
    logger.warn("Unexpected Super Dispatch PUT response structure", {
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

