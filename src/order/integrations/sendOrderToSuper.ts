/**
 * Send Order to Super Dispatch Integration
 *
 * This service handles sending orders to Super Dispatch TMS
 */

import { logger } from "@/core/logger";
import { IOrder, IPortal } from "@/_global/models";

interface SendOrderToSuperParams {
  quotes: any[];
  uniqueId: string;
  reg: number;
  portal: IPortal;
  dateRanges: Date[];
  pickupCoords: { latitude: string; longitude: string };
  deliveryCoords: { latitude: string; longitude: string };
  pickupNotes: string | null;
  deliveryNotes: string | null;
  transportType: string;
  pickupAddress: string;
  pickupCity: string;
  pickupState: string;
  pickupZip: string;
  pickupBusinessName: string;
  pickupContactName: string;
  pickupEmail: string;
  pickupPhone: string;
  pickupMobile: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  deliveryBusinessName: string;
  deliveryContactName: string;
  deliveryEmail: string;
  deliveryPhone: string;
  deliveryMobile: string;
  serviceLevel: number;
}

export const sendOrderToSuper = async (
  params: SendOrderToSuperParams,
): Promise<any> => {
  try {
    const {
      quotes,
      uniqueId,
      reg,
      portal,
      dateRanges,
      pickupCoords,
      deliveryCoords,
      pickupNotes,
      deliveryNotes,
      transportType,
      pickupAddress,
      pickupCity,
      pickupState,
      pickupZip,
      pickupBusinessName,
      pickupContactName,
      pickupEmail,
      pickupPhone,
      pickupMobile,
      deliveryAddress,
      deliveryCity,
      deliveryState,
      deliveryZip,
      deliveryBusinessName,
      deliveryContactName,
      deliveryEmail,
      deliveryPhone,
      deliveryMobile,
      serviceLevel,
    } = params;

    // Format vehicles for Super Dispatch
    const formattedVehicles = quotes.map((quote) => ({
      make: quote.make,
      model: quote.model,
      year: quote.year,
      vin: quote.vin,
      operable: quote.operableBool,
      type: quote.pricingClass?.toLowerCase() || "other",
    }));

    // Format pickup and delivery dates
    const pickupStartDate = dateRanges[0].toISOString().split("T")[0];
    const pickupEndDate = dateRanges[1].toISOString().split("T")[0];
    const deliveryStartDate = dateRanges[2].toISOString().split("T")[0];
    const deliveryEndDate = dateRanges[3].toISOString().split("T")[0];

    const orderData = {
      number: uniqueId,
      purchase_order_number: reg,
      pickup: {
        first_available_pickup_date: pickupStartDate,
        scheduled_at: pickupStartDate,
        scheduled_ends_at: pickupEndDate,
        notes: pickupNotes,
        date_type: "estimated",
        venue: {
          address: pickupAddress,
          city: pickupCity,
          state: pickupState,
          zip: pickupZip,
          name: pickupBusinessName,
          contact_name: pickupContactName,
          contact_email: pickupEmail,
          contact_phone: pickupPhone,
          contact_mobile_phone: pickupMobile,
        },
      },
      delivery: {
        scheduled_at: deliveryStartDate,
        scheduled_ends_at: deliveryEndDate,
        notes: deliveryNotes,
        date_type: "estimated",
        venue: {
          address: deliveryAddress,
          city: deliveryCity,
          state: deliveryState,
          zip: deliveryZip,
          name: deliveryBusinessName,
          contact_name: deliveryContactName,
          contact_email: deliveryEmail,
          contact_phone: deliveryPhone,
          contact_mobile_phone: deliveryMobile,
        },
      },
      customer: {
        address: portal.address?.address,
        city: portal.address?.city,
        state: portal.address?.state,
        zip: portal.address?.zip,
        name: portal.companyName,
        business_type: "BUSINESS",
        email: portal.contact?.email,
        phone: portal.contact?.phone,
        contact_name: portal.contact?.name,
        contact_phone: portal.contact?.phone,
        contact_email: portal.contact?.email,
      },
      vehicles: formattedVehicles,
      transport_type: transportType.toUpperCase(),
    };

    // Make API call to Super Dispatch
    const response = await fetch(
      process.env.SUPERDISPATCH_API_URL + "/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPERDISPATCH_API_TOKEN}`,
        },
        body: JSON.stringify(orderData),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Super Dispatch API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(
        `Super Dispatch API error: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();

    logger.info("Successfully sent order to Super Dispatch", {
      uniqueId,
      superDispatchGuid: result.guid,
    });

    return result;
  } catch (error) {
    logger.error("Error sending order to Super Dispatch:", error);
    throw error;
  }
};

