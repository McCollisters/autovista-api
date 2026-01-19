/**
 * Send Partial Order to Super Dispatch Integration
 *
 * This service sends a partial order to Super Dispatch TMS with minimal information.
 * Addresses are withheld until carrier approval.
 */

import { logger } from "@/core/logger";
import { IPortal } from "@/_global/models";
import { IVehicle } from "@/_global/schemas/types";
import { DateTime } from "luxon";
import { authenticateSuperDispatch } from "@/_global/integrations/authenticateSuperDispatch";

interface VehicleWithCalculatedQuotes extends IVehicle {
  calculatedQuotes?: any[] | string;
}

interface SendPartialOrderToSuperParams {
  quotes: VehicleWithCalculatedQuotes[];
  orderNumber: string;
  reg?: number;
  portal: IPortal;
  dateRanges: Date[];
  transportType: string;
  pickupCity: string;
  pickupState: string;
  pickupZip: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  serviceLevel: number;
}

interface VehicleData {
  tariff: number;
  make: string;
  model: string;
  is_inoperable: boolean;
  type: string;
  year?: string | number | null;
  vin?: string | null;
}

/**
 * Send partial order to Super Dispatch
 * Sends order with minimal information - addresses are withheld until carrier approval
 */
export const sendPartialOrderToSuper = async (
  params: SendPartialOrderToSuperParams,
): Promise<any> => {
  try {
    const {
      quotes,
      orderNumber,
      reg,
      portal,
      dateRanges,
      transportType,
      pickupCity,
      pickupState,
      pickupZip,
      deliveryCity,
      deliveryState,
      deliveryZip,
      serviceLevel,
    } = params;

    // Authenticate with Super Dispatch and get token
    const token = await authenticateSuperDispatch();

    const normalizeZip = (value?: string | number | null) => {
      if (!value && value !== 0) {
        return "";
      }
      const digits = String(value).match(/\d{5}/)?.[0] || "";
      return digits;
    };

    const normalizeText = (value?: string | number | null) =>
      value == null ? "" : String(value).trim();

    const normalizeState = (value?: string | number | null) => {
      const normalized = normalizeText(value).toUpperCase();
      return normalized.length === 2 ? normalized : "";
    };

    const removeEmpty = (value: any): any => {
      if (Array.isArray(value)) {
        const cleaned = value
          .map((item) => removeEmpty(item))
          .filter((item) => item !== undefined);
        return cleaned.length > 0 ? cleaned : undefined;
      }
      if (value && typeof value === "object") {
        const entries = Object.entries(value)
          .map(([key, val]) => [key, removeEmpty(val)] as const)
          .filter(([, val]) => val !== undefined);
        if (entries.length === 0) {
          return undefined;
        }
        return Object.fromEntries(entries);
      }
      if (value === null || value === undefined) {
        return undefined;
      }
      if (typeof value === "string" && value.trim() === "") {
        return undefined;
      }
      return value;
    };

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

    const normalizedServiceLevel = Number(serviceLevel);
    const totalsKey =
      normalizedServiceLevel === 1
        ? "one"
        : normalizedServiceLevel === 3
          ? "three"
          : normalizedServiceLevel === 5
            ? "five"
            : "seven";
    const transportTypeKey =
      String(transportType || "").toUpperCase() === "ENCLOSED"
        ? "enclosed"
        : "open";

    const normalizedPickupCity = normalizeText(pickupCity);
    const normalizedPickupState = normalizeState(pickupState);
    const normalizedPickupZip = normalizeZip(pickupZip);
    const normalizedDeliveryCity = normalizeText(deliveryCity);
    const normalizedDeliveryState = normalizeState(deliveryState);
    const normalizedDeliveryZip = normalizeZip(deliveryZip);

    const missingFields: string[] = [];
    if (!normalizedPickupCity) missingFields.push("pickup.city");
    if (!normalizedPickupState) missingFields.push("pickup.state");
    if (!normalizedPickupZip) missingFields.push("pickup.zip");
    if (!normalizedDeliveryCity) missingFields.push("delivery.city");
    if (!normalizedDeliveryState) missingFields.push("delivery.state");
    if (!normalizedDeliveryZip) missingFields.push("delivery.zip");

    // Format vehicle data for Super Dispatch
    const vehicleData: VehicleData[] = quotes.map((quote) => {
      const make = normalizeText(quote.make);
      const model = normalizeText(quote.model);
      if (!make || !model) {
        missingFields.push("vehicle.make/model");
      }
      const totalsForLevel = (quote as any)?.pricing?.totals?.[totalsKey];
      const totalOpen =
        totalsForLevel?.open?.totalWithCompanyTariffAndCommission ??
        totalsForLevel?.open?.total ??
        totalsForLevel?.totalWithCompanyTariffAndCommission ??
        totalsForLevel?.total;
      const totalEnclosed =
        totalsForLevel?.enclosed?.totalWithCompanyTariffAndCommission ??
        totalsForLevel?.enclosed?.total ??
        totalsForLevel?.totalWithCompanyTariffAndCommission ??
        totalsForLevel?.total;

      if (totalOpen == null && totalEnclosed == null) {
        logger.error("No pricing totals found for vehicle", {
          serviceLevel,
          make: quote.make,
          model: quote.model,
        });
        throw new Error(
          `No pricing found for service level ${serviceLevel} for vehicle ${quote.make} ${quote.model}`,
        );
      }

      const totalSDTariff =
        transportTypeKey === "open" ? (totalOpen ?? 0) : (totalEnclosed ?? 0);

      const inoperable = Boolean((quote as any).isInoperable);
      const vinValue = normalizeText(quote.vin);

      const parsedYear = quote.year ? parseInt(String(quote.year), 10) : NaN;
      return {
        tariff: Number.isFinite(totalSDTariff) ? totalSDTariff : 0,
        make,
        model,
        is_inoperable: inoperable,
        type: resolveVehicleType(quote.pricingClass),
        year: Number.isFinite(parsedYear) ? parsedYear : null,
        vin: vinValue || null,
      };
    });

    if (missingFields.length > 0) {
      logger.error("Missing required data for Super Dispatch partial order", {
        orderNumber,
        missingFields: Array.from(new Set(missingFields)),
      });
      throw new Error(
        `Missing required Super Dispatch fields: ${Array.from(
          new Set(missingFields),
        ).join(", ")}`,
      );
    }

    const formatSuperDispatchDate = (value: Date) =>
      `${DateTime.fromJSDate(new Date(value))
        .toUTC()
        .toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS")}+0000`;

    // Format dates (Super Dispatch expects timestamp with UTC offset)
    const pickupStartDate = formatSuperDispatchDate(dateRanges[0]);
    const pickupEndDate = formatSuperDispatchDate(dateRanges[1]);
    const deliveryStartDate = formatSuperDispatchDate(dateRanges[2]);
    const deliveryEndDate = formatSuperDispatchDate(dateRanges[3]);

    // Build partial order payload (mirror mc_portal_api)
    const orderDetails = {
      number: String(orderNumber),
      purchase_order_number: reg ? String(reg) : null,
      instructions:
        "Full order details will be released upon carrier approval by our office within 1 business day",
      payment: {
        method: "other",
        terms: "other",
      },
      pickup: {
        date_type: "estimated",
        first_available_pickup_date: pickupStartDate,
        scheduled_at: pickupStartDate,
        scheduled_ends_at: pickupEndDate,
        venue: {
          address: "123 Example St. ADDRESS WITTHELD",
          city: normalizedPickupCity,
          state: normalizedPickupState,
        },
      },
      delivery: {
        date_type: "estimated",
        scheduled_at: deliveryStartDate,
        scheduled_ends_at: deliveryEndDate,
        venue: {
          address: "123 Example St. ADDRESS WITTHELD",
          city: normalizedDeliveryCity,
          state: normalizedDeliveryState,
        },
      },
      transport_type: String(transportType || "").toUpperCase(),
      vehicles: vehicleData,
    };

    const sanitizedOrderDetails = removeEmpty(orderDetails);
    logger.info("Super Dispatch partial order payload", {
      orderNumber,
      payload: sanitizedOrderDetails,
    });

    // Make API call to Super Dispatch
    const apiUrl = "https://api.shipper.superdispatch.com/v1/public";

    const response = await fetch(`${apiUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(sanitizedOrderDetails),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Super Dispatch API error response:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        orderNumber,
      });
      throw new Error(
        `Super Dispatch API error: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();

    // Handle Super Dispatch validation errors
    if (result.data?.error_id) {
      logger.error("Super Dispatch validation error:", {
        errorId: result.data.error_id,
        message: result.data.message,
        orderNumber,
      });
      throw new Error(
        `Super Dispatch validation error: ${result.data.message}`,
      );
    }

    // Return the order object from response
    if (result.data?.object) {
      logger.info("Successfully sent partial order to Super Dispatch", {
        orderNumber,
        superDispatchGuid: result.data.object.guid,
      });
      return result.data.object;
    }

    // Fallback: return the full response if structure is different
    logger.warn("Unexpected Super Dispatch response structure", {
      orderNumber,
      response: result,
    });
    return result.data || result;
  } catch (error) {
    logger.error("Error sending partial order to Super Dispatch:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orderNumber: params.orderNumber,
    });
    throw error;
  }
};
