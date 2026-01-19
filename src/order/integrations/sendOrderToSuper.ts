/**
 * Send Order to Super Dispatch Integration
 *
 * This service handles sending orders to Super Dispatch TMS
 */

import { logger } from "@/core/logger";
import { IOrder, IPortal } from "@/_global/models";
import { DateTime } from "luxon";

interface SendOrderToSuperParams {
  quotes: any[];
  orderNumber: string;
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
      orderNumber,
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

    const normalizeZip = (value?: string | number | null) => {
      if (!value && value !== 0) {
        return "";
      }
      const digits = String(value).match(/\d{5}/)?.[0] || "";
      return digits;
    };

    const normalizeText = (value?: string | number | null) =>
      value == null ? "" : String(value).trim();

    const normalizeZipNumber = (value?: string | number | null) => {
      const digits = normalizeZip(value);
      if (!digits) {
        return undefined;
      }
      const parsed = Number.parseInt(digits, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const formatSuperDispatchDate = (value: Date) =>
      `${DateTime.fromJSDate(new Date(value))
        .toUTC()
        .toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS")}+0000`;

    const resolveVehicleType = (pricingClass?: string | null) => {
      const normalized = normalizeText(pricingClass).toLowerCase();
      if (!normalized) {
        return "other";
      }
      const mappedTypes: Record<string, string> = {
        sedan: "sedan",
        suv: "suv",
        van: "van",
        pickup_4_doors: "4_door_pickup",
        pickup_2_doors: "2_door_pickup",
        pickup: "pickup",
        other: "other",
      };
      return mappedTypes[normalized] || "other";
    };

    // Format vehicles for Super Dispatch
    const formattedVehicles = quotes.map((quote) => {
      const isInoperable = Boolean((quote as any).isInoperable);
      const parsedYear = quote.year ? parseInt(String(quote.year), 10) : NaN;
      const vinValue = normalizeText(quote.vin);
      return {
        make: normalizeText(quote.make),
        model: normalizeText(quote.model),
        year: Number.isFinite(parsedYear) ? parsedYear : null,
        vin: vinValue || null,
        operable: !isInoperable,
        type: resolveVehicleType(quote.pricingClass),
      };
    });

    // Format pickup and delivery dates
    const pickupStartDate = formatSuperDispatchDate(dateRanges[0]);
    const pickupEndDate = formatSuperDispatchDate(dateRanges[1]);
    const deliveryStartDate = formatSuperDispatchDate(dateRanges[2]);
    const deliveryEndDate = formatSuperDispatchDate(dateRanges[3]);

    const orderData = {
      number: String(orderNumber),
      purchase_order_number: reg,
      payment: {
        method: "other",
        terms: "other",
      },
      pickup: {
        first_available_pickup_date: pickupStartDate,
        scheduled_at: pickupStartDate,
        scheduled_ends_at: pickupEndDate,
        notes: pickupNotes,
        date_type: "estimated",
        latitude: pickupCoords?.latitude || null,
        longitude: pickupCoords?.longitude || null,
        venue: {
          address: normalizeText(pickupAddress),
          city: normalizeText(pickupCity),
          state: normalizeText(pickupState),
          zip: normalizeZipNumber(pickupZip),
          name: normalizeText(pickupBusinessName),
          contact_name: normalizeText(pickupContactName),
          contact_email: normalizeText(pickupEmail),
          contact_phone: normalizeText(pickupPhone),
          contact_mobile_phone: normalizeText(pickupMobile),
        },
      },
      delivery: {
        scheduled_at: deliveryStartDate,
        scheduled_ends_at: deliveryEndDate,
        notes: deliveryNotes,
        date_type: "estimated",
        latitude: deliveryCoords?.latitude || null,
        longitude: deliveryCoords?.longitude || null,
        venue: {
          address: normalizeText(deliveryAddress),
          city: normalizeText(deliveryCity),
          state: normalizeText(deliveryState),
          zip: normalizeZipNumber(deliveryZip),
          name: normalizeText(deliveryBusinessName),
          contact_name: normalizeText(deliveryContactName),
          contact_email: normalizeText(deliveryEmail),
          contact_phone: normalizeText(deliveryPhone),
          contact_mobile_phone: normalizeText(deliveryMobile),
        },
      },
      customer: {
        address: portal.address?.address || null,
        city: portal.address?.city || null,
        state: portal.address?.state || null,
        zip: portal.address?.zip || null,
        name: portal.companyName || "McCollister's Auto Logistics",
        business_type: "BUSINESS",
        email: portal.contact?.email || null,
        phone: portal.contact?.phone || null,
        contact_name: portal.contact?.name || null,
        contact_phone: portal.contact?.phone || null,
        contact_email: portal.contact?.email || null,
      },
      vehicles: formattedVehicles,
      transport_type: String(transportType || "").toUpperCase(),
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
      orderNumber,
      superDispatchGuid: result.guid,
    });

    return result;
  } catch (error) {
    logger.error("Error sending order to Super Dispatch:", error);
    throw error;
  }
};
