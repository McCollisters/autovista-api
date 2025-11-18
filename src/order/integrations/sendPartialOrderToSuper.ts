/**
 * Send Partial Order to Super Dispatch Integration
 *
 * This service sends a partial order to Super Dispatch TMS with minimal information.
 * Addresses are withheld until carrier approval.
 */

import { logger } from "@/core/logger";
import { IPortal, IQuoteVehicle } from "@/_global/models";
import { format } from "date-fns";
import { authenticateSuperDispatch } from "@/_global/integrations/authenticateSuperDispatch";

interface SendPartialOrderToSuperParams {
  quotes: IQuoteVehicle[];
  uniqueId: string;
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
      uniqueId,
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

    // Format vehicle data for Super Dispatch
    const vehicleData: VehicleData[] = quotes.map((quote) => {
      let calculatedQuotes = quote.calculatedQuotes;

      // Parse JSON if string
      if (
        typeof calculatedQuotes === "string" ||
        calculatedQuotes instanceof String
      ) {
        calculatedQuotes = JSON.parse(calculatedQuotes);
      }

      // Find quote for the specified service level
      const calculatedQuote = calculatedQuotes.find((q: any) => {
        return parseInt(q.days) === serviceLevel;
      });

      if (!calculatedQuote) {
        logger.error(
          `No calculated quote found for service level ${serviceLevel}`,
        );
        throw new Error(
          `No pricing found for service level ${serviceLevel} for vehicle ${quote.make} ${quote.model}`,
        );
      }

      let totalSDTariff: number;

      if (transportType === "OPEN") {
        totalSDTariff = calculatedQuote.openTransportSD;
      } else {
        totalSDTariff = calculatedQuote.enclosedTransportSD;
      }

      // Determine if vehicle is inoperable
      let inoperable = false;
      if (
        quote.operableBool === false ||
        quote.operable === false ||
        quote.operable === "false" ||
        quote.operable === "No"
      ) {
        inoperable = true;
      }

      // Format vehicle type
      let type = quote.pricingClass?.toLowerCase() || "other";

      if (type === "pick up 4 doors") {
        type = "4_door_pickup";
      }

      if (type === "pick up 2 doors") {
        type = "2_door_pickup";
      }

      return {
        tariff: totalSDTariff,
        make: quote.make,
        model: quote.model,
        is_inoperable: inoperable,
        type,
      };
    });

    // Format dates (Super Dispatch expects YYYY-MM-DD format)
    const pickupStartDate = format(new Date(dateRanges[0]), "yyyy-MM-dd");
    const pickupEndDate = format(new Date(dateRanges[1]), "yyyy-MM-dd");
    const deliveryStartDate = format(new Date(dateRanges[2]), "yyyy-MM-dd");
    const deliveryEndDate = format(new Date(dateRanges[3]), "yyyy-MM-dd");

    // Build partial order payload
    const orderDetails = {
      number: uniqueId,
      purchase_order_number: reg || null,
      portalNotificationEmail:
        portal.notificationEmail || portal.contact?.email,
      instructions:
        "Full order details will be released upon carrier approval by our office within 1 business day",
      payment: {
        method: "other",
        terms: "other",
      },
      customer: {
        name: null,
        address: null,
        city: portal.address?.city || portal.companyCity || null,
        state: portal.address?.state || portal.companyState || null,
      },
      pickup: {
        date_type: "estimated",
        first_available_pickup_date: pickupStartDate,
        scheduled_at: pickupStartDate,
        scheduled_ends_at: pickupEndDate,
        venue: {
          address: "123 Example St. ADDRESS WITTHELD",
          city: pickupCity,
          state: pickupState,
          zip: pickupZip,
        },
      },
      delivery: {
        date_type: "estimated",
        scheduled_at: deliveryStartDate,
        scheduled_ends_at: deliveryEndDate,
        venue: {
          address: "123 Example St. ADDRESS WITTHELD",
          city: deliveryCity,
          state: deliveryState,
          zip: deliveryZip,
        },
      },
      transport_type: transportType.toUpperCase(),
      vehicles: vehicleData,
    };

    // Make API call to Super Dispatch
    const apiUrl = "https://api.shipper.superdispatch.com/v1/public";

    const response = await fetch(`${apiUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderDetails),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Super Dispatch API error response:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        uniqueId,
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
        uniqueId,
      });
      throw new Error(
        `Super Dispatch validation error: ${result.data.message}`,
      );
    }

    // Return the order object from response
    if (result.data?.object) {
      logger.info("Successfully sent partial order to Super Dispatch", {
        uniqueId,
        superDispatchGuid: result.data.object.guid,
      });
      return result.data.object;
    }

    // Fallback: return the full response if structure is different
    logger.warn("Unexpected Super Dispatch response structure", {
      uniqueId,
      response: result,
    });
    return result.data || result;
  } catch (error) {
    logger.error("Error sending partial order to Super Dispatch:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      uniqueId: params.uniqueId,
    });
    throw error;
  }
};
