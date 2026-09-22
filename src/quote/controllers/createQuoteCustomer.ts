import express from "express";
import { Quote, Portal, Settings } from "@/_global/models";
import { Status, TransportType } from "../../_global/enums";
import { getCoordinates } from "../../_global/utils/location";
import { getMiles } from "../services/getMiles";
import { updateVehiclesWithPricing } from "../services/updateVehiclesWithPricing";
import { calculateTotalPricing } from "../services/calculateTotalPricing";
import { validateLocation } from "../services/validateLocation";
import { customAlphabet } from "nanoid";
import { logger } from "@/core/logger";
import { getTransitTimeFromSettings } from "../services/getTransitTimeFromSettings";
import { resolveId } from "@/_global/utils/resolveId";
import {
  getMinimumCustomerPickupDate,
  isPickupDateAllowed,
  parseDateOnlyInput,
} from "../utils/customerPickupDate";
import { sendQuoteEmailToCustomer } from "../services/sendQuoteEmailToCustomer";

const nanoid = customAlphabet("1234567890abcdef", 10);

/** Normalize and extract customer email from public quote payloads (nested or flat). */
function normalizeCustomerEmail(body: Record<string, unknown>): string | null {
  const pick = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const raw =
    pick((body?.customer as { email?: unknown } | undefined)?.email) ||
    pick(body?.customerEmail) ||
    pick(body?.email);
  if (!raw) return null;
  return raw.toLowerCase();
}

/**
 * POST /api/v1/quote/customer
 * Create quote from customer (public endpoint)
 * 
 * Creates a quote with a customer-facing tracking code
 */
export const createQuoteCustomer = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    // Generate unique customer-facing code
    const userFriendlyId = nanoid().toUpperCase();

    // Extract quote details from request
    let {
      customerFirstName,
      customerLastName,
      customerFullName,
      customer,
      pickup,
      delivery,
      vehicles,
      portalId,
      instance,
      transportType,
      pickupStartDate: pickupStartDateRaw,
    } = req.body;
    const resolvedPortalId = resolveId(req.body?.portal ?? portalId);

    // Validation
    if (!pickup) {
      return next({
        statusCode: 400,
        message: "Please enter a valid pickup location.",
      });
    }

    if (!delivery) {
      return next({
        statusCode: 400,
        message: "Please enter a valid delivery location.",
      });
    }

    if (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) {
      return next({
        statusCode: 400,
        message: "Please enter valid vehicles.",
      });
    }

    // Validate pickup/delivery are 5-digit zip codes if numeric
    const pickupNumOnly = /^\d+$/.test(pickup);
    if (pickupNumOnly && pickup.toString().length !== 5) {
      return next({
        statusCode: 400,
        message: "Please enter a valid pickup location.",
      });
    }

    const deliveryNumOnly = /^\d+$/.test(delivery);
    if (deliveryNumOnly && delivery.toString().length !== 5) {
      return next({
        statusCode: 400,
        message: "Please enter a valid delivery location.",
      });
    }

    // Clean up vehicles - normalize operable field and extract make/model from objects
    vehicles = vehicles.map((v: any) => {
      const hasExplicitInoperable =
        typeof v.isInoperable === "boolean" ? v.isInoperable : undefined;
      const isOperable =
        hasExplicitInoperable !== undefined
          ? !hasExplicitInoperable
          : !(
              v.operable === "No" ||
              v.operable === false ||
              v.operable === "false" ||
              v.operable?.value === "No"
            );
      
      // Extract make - handle both string and object formats
      let make = v.make;
      if (make && typeof make === 'object') {
        make = make.value || make.label || make;
      }
      
      // Extract model - handle both string and object formats
      let model = v.model;
      if (model && typeof model === 'object') {
        model = model.value || model.label || model;
      }
      
      // Extract pricingClass if provided in model object
      let pricingClass = v.pricingClass;
      if (model && typeof model === 'object' && model.pricingClass) {
        pricingClass = model.pricingClass;
      }
      
      return {
        ...v,
        make: typeof make === 'string' ? make : String(make),
        model: typeof model === 'string' ? model : String(model),
        pricingClass: pricingClass || v.pricingClass,
        isInoperable: !isOperable,
      };
    });

    // Clean up transport type
    transportType = transportType?.value || transportType;

    // Format customer name
    const formatName = (name: string) => {
      if (!name) return "";
      return name
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    };

    const formattedFirstName =
      customerFirstName ?? (customer as any)?.firstName ?? "";
    const formattedLastName =
      customerLastName ?? (customer as any)?.lastName ?? "";
    const formattedFirst = formattedFirstName
      ? formatName(String(formattedFirstName))
      : "";
    const formattedLast = formattedLastName
      ? formatName(String(formattedLastName))
      : "";
    const formattedFullName =
      formattedFirst && formattedLast
        ? `${formattedFirst} ${formattedLast}`
        : customer?.name
        ? formatName(customer.name)
        : customerFullName
        ? formatName(customerFullName)
        : null;
    const formattedEmail = normalizeCustomerEmail(req.body as Record<string, unknown>);

    // Validate locations
    const originValidated = await validateLocation(pickup);
    if (originValidated.error) {
      return next({
        statusCode: 500,
        message: originValidated.error,
      });
    }

    const destinationValidated = await validateLocation(delivery);
    if (destinationValidated.error) {
      return next({
        statusCode: 500,
        message: destinationValidated.error,
      });
    }

    const originState = originValidated.state || "";
    const originLocation = originValidated.location || pickup;
    const destinationState = destinationValidated.state || "";
    const destinationLocation = destinationValidated.location || delivery;

    // Get coordinates
    const originCoords = await getCoordinates(originLocation);
    const destinationCoords = await getCoordinates(destinationLocation);

    if (!originCoords || !destinationCoords) {
      return next({
        statusCode: 500,
        message: "Error getting location coordinates.",
      });
    }

    // Calculate miles
    const miles = await getMiles(originCoords, destinationCoords);

    if (!miles) {
      return next({
        statusCode: 500,
        message: "Error calculating distance.",
      });
    }

    let transitTime: [number, number] | null = null;
    let holidayDates: Date[] = [];
    try {
      const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
      const transitTimes = Array.isArray(settings?.transitTimes)
        ? settings.transitTimes
        : [];
      transitTime = getTransitTimeFromSettings(miles, transitTimes);
      holidayDates = Array.isArray(settings?.holidays)
        ? settings.holidays.map((h: Date | string) =>
            h instanceof Date ? h : new Date(h),
          )
        : [];
    } catch (error) {
      transitTime = null;
    }

    let pickupStartDate: Date | undefined;
    if (
      pickupStartDateRaw !== undefined &&
      pickupStartDateRaw !== null &&
      pickupStartDateRaw !== ""
    ) {
      const rawStr =
        typeof pickupStartDateRaw === "string"
          ? pickupStartDateRaw
          : String(pickupStartDateRaw);
      const parsed =
        parseDateOnlyInput(rawStr) ||
        (() => {
          const d = new Date(rawStr);
          return isNaN(d.getTime()) ? null : d;
        })();
      if (!parsed) {
        return next({
          statusCode: 400,
          message: "Please enter a valid pickup date.",
        });
      }
      const normalizedPickup = new Date(
        parsed.getFullYear(),
        parsed.getMonth(),
        parsed.getDate(),
      );
      const minPickup = getMinimumCustomerPickupDate(new Date(), holidayDates);
      if (!isPickupDateAllowed(normalizedPickup, minPickup, holidayDates)) {
        return next({
          statusCode: 400,
          message:
            "Pickup date must be at least three business days from today and cannot fall on a weekend or holiday.",
        });
      }
      pickupStartDate = normalizedPickup;
    }

    // Get portal
    const portal = await Portal.findById(resolvedPortalId);
    if (!portal) {
      return next({
        statusCode: 404,
        message: "Portal not found.",
      });
    }

    // Update vehicles with pricing
    const vehicleQuotes = await updateVehiclesWithPricing({
      portal,
      vehicles,
      miles,
      origin: originLocation,
      destination: destinationLocation,
      commission: 0, // Customer quotes typically don't have commission
    });

    // Calculate total pricing
    const totalPricing = await calculateTotalPricing(vehicleQuotes, portal);

    // Create quote
    const quoteData = {
      status: Status.Active,
      portal: resolvedPortalId,
      isCustomerPortal: true,
      customer: {
        name: formattedFullName,
        firstName: formattedFirst || undefined,
        lastName: formattedLast || undefined,
        email: formattedEmail,
        phone: customer?.phone || null,
        trackingCode: userFriendlyId,
      },
      origin: {
        userInput: pickup,
        validated: originLocation,
        state: originState,
        coordinates: {
          long: originCoords[0],
          lat: originCoords[1],
        },
      },
      destination: {
        userInput: delivery,
        validated: destinationLocation,
        state: destinationState,
        coordinates: {
          long: destinationCoords[0],
          lat: destinationCoords[1],
        },
      },
      miles,
      transitTime: transitTime ?? [],
      ...(transportType && { transportType: transportType as TransportType }),
      // Stored on Quote.pickupStartDate (see quote schema) when the client sends a valid date.
      ...(pickupStartDate && { pickupStartDate }),
      vehicles: vehicleQuotes,
      totalPricing,
    };

    const quote = await new Quote(quoteData).save();

    let quoteConfirmationEmailSent = false;
    let quoteConfirmationEmailError: string | undefined;

    if (!formattedEmail) {
      logger.warn(
        "createQuoteCustomer: no customer email in request; skipping confirmation email",
        {
          quoteId: quote._id,
          hasCustomerObject: !!req.body?.customer,
        },
      );
    } else {
      try {
        const emailResult = await sendQuoteEmailToCustomer(
          quote.toObject(),
          formattedEmail,
        );
        quoteConfirmationEmailSent = emailResult.success;
        if (!emailResult.success) {
          quoteConfirmationEmailError = emailResult.error;
          logger.warn("Failed to send customer quote confirmation email", {
            quoteId: quote._id,
            recipientEmail: formattedEmail,
            error: emailResult.error,
          });
        } else {
          logger.info("Customer quote confirmation email sent", {
            quoteId: quote._id,
            recipientEmail: formattedEmail,
          });
        }
      } catch (emailError) {
        quoteConfirmationEmailError =
          emailError instanceof Error ? emailError.message : String(emailError);
        logger.warn("Failed to send customer quote confirmation email", {
          error: quoteConfirmationEmailError,
          quoteId: quote._id,
        });
      }
    }

    logger.info(`Customer created quote ${quote.refId}`, {
      quoteId: quote._id,
      refId: quote.refId,
      trackingCode: userFriendlyId,
      pickupStartDate: quote.pickupStartDate ?? null,
      quoteConfirmationEmailSent,
    });

    const quoteJson = quote.toObject();
    res.status(200).json({
      ...quoteJson,
      quoteConfirmationEmailSent,
      ...(quoteConfirmationEmailError && {
        quoteConfirmationEmailError,
      }),
    });
  } catch (error) {
    logger.error("Error creating customer quote", {
      error: error instanceof Error ? error.message : error,
      portal: req.body?.portal ?? req.body?.portalId,
    });
    next({
      statusCode: 500,
      message:
        "Something went wrong calculating this quote. Please try again later or contact us for assistance.",
    });
  }
};

