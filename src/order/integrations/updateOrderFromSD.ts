/**
 * Update order from SuperDispatch data
 *
 * This function processes a full Super Dispatch order object and updates the database order.
 * It includes checks to prevent overriding sensitive data from partial orders and withheld addresses.
 */

import { DateTime } from "luxon";
import { IOrder, IPortal, Portal } from "@/_global/models";
import { Status } from "@/_global/enums";
import { logger } from "@/core/logger";
import { isWithheldAddress } from "../utils/checkWithheldAddress";

interface SuperDispatchOrder {
  guid: string;
  status: string;
  created_at: string;
  changed_at: string;
  purchase_order_number?: string;
  transport_type: string;
  customer?: {
    name?: string;
    contact_email?: string;
    contact_name?: string;
    phone?: string;
    notes?: string;
  };
  pickup: {
    scheduled_at?: string;
    scheduled_ends_at?: string;
    adjusted_date?: string;
    date_type?: string;
    longitude?: string;
    latitude?: string;
    notes?: string;
    venue: {
      name?: string;
      contact_name?: string;
      contact_phone?: string;
      contact_mobile_phone?: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  };
  delivery: {
    scheduled_at?: string;
    scheduled_ends_at?: string;
    adjusted_date?: string;
    completed_at?: string;
    date_type?: string;
    longitude?: string;
    latitude?: string;
    notes?: string;
    venue: {
      name?: string;
      contact_name?: string;
      contact_phone?: string;
      contact_mobile_phone?: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  };
  vehicles: Array<{
    tariff: number;
    vin?: string;
    year?: string;
    make: string;
    model: string;
    is_inoperable: boolean;
    type: string;
    color?: string;
  }>;
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

function processDate(dateString: string | undefined): DateTime | null {
  if (!dateString) return null;
  try {
    return DateTime.fromISO(dateString).setZone("America/New_York");
  } catch (e) {
    return null;
  }
}

function generateDateString(dateObj: DateTime | Date | null): string | null {
  if (!dateObj) return null;

  try {
    let date: DateTime;
    if (dateObj instanceof Date) {
      date = DateTime.fromJSDate(dateObj).setZone("America/New_York");
    } else {
      date = dateObj;
    }
    return `${date.month}/${date.day}/${date.year}`;
  } catch (e) {
    return null;
  }
}

function isValidDate(dateString: string | undefined): boolean {
  if (!dateString) return false;

  try {
    const date = DateTime.fromISO(dateString);
    const minDate = DateTime.fromISO("2000-01-01");
    const maxDate = DateTime.now().plus({ years: 5 });

    return date.isValid && date >= minDate && date <= maxDate;
  } catch (e) {
    return false;
  }
}

// ============================================================================
// STATUS PROCESSING
// ============================================================================

function normalizeStatus(sdStatus: string): string {
  let statusString = sdStatus.replace("_", " ");
  statusString = statusString[0].toUpperCase() + statusString.substring(1);

  const statusMap: Record<string, string> = {
    Invoiced: "Delivered",
    "Picked up": "Picked Up",
    "Order canceled": "Canceled",
  };

  if (statusMap[statusString]) {
    statusString = statusMap[statusString];
  }

  if (["Accepted", "New", "Pending"].includes(statusString)) {
    statusString = "New";
  }

  return statusString;
}

// ============================================================================
// DATE PROCESSING
// ============================================================================

interface ProcessedDates {
  scheduledAt?: DateTime;
  scheduledAtString?: string | null;
  scheduledEndsAt?: DateTime;
  scheduledEndsAtString?: string | null;
  adjustedDate?: DateTime;
  adjustedDateString?: string | null;
  orderTablePickupEst?: DateTime;
  orderTablePickupEnd?: DateTime;
  orderTablePickupActual?: DateTime;
  orderTableDeliveryEst?: DateTime;
  orderTableDeliveryEnd?: DateTime;
  orderTableDeliveryActual?: DateTime;
}

function processPickupDates(sdOrder: SuperDispatchOrder): ProcessedDates {
  const pickup = sdOrder.pickup;
  const dates: ProcessedDates = {};

  if (pickup.scheduled_at && isValidDate(pickup.scheduled_at)) {
    dates.scheduledAt = processDate(pickup.scheduled_at);
    dates.scheduledAtString = generateDateString(dates.scheduledAt);
    dates.orderTablePickupEst = dates.scheduledAt;
  }

  if (pickup.scheduled_ends_at && isValidDate(pickup.scheduled_ends_at)) {
    dates.scheduledEndsAt = processDate(pickup.scheduled_ends_at);
    dates.scheduledEndsAtString = generateDateString(dates.scheduledEndsAt);
    dates.orderTablePickupEnd = dates.scheduledEndsAt;
  }

  if (pickup.adjusted_date && isValidDate(pickup.adjusted_date)) {
    dates.adjustedDate = processDate(pickup.adjusted_date);
    dates.adjustedDateString = generateDateString(dates.adjustedDate);
    dates.orderTablePickupActual = dates.adjustedDate;
  } else if (
    !["new", "accepted"].includes(sdOrder.status.toLowerCase()) &&
    pickup.scheduled_at &&
    isValidDate(pickup.scheduled_at)
  ) {
    dates.adjustedDate = processDate(pickup.scheduled_at);
    dates.adjustedDateString = generateDateString(dates.adjustedDate);
  }

  return dates;
}

function processDeliveryDates(sdOrder: SuperDispatchOrder): ProcessedDates {
  const delivery = sdOrder.delivery;
  const dates: ProcessedDates = {};

  if (delivery.scheduled_at && isValidDate(delivery.scheduled_at)) {
    dates.scheduledAt = processDate(delivery.scheduled_at);
    dates.scheduledAtString = generateDateString(dates.scheduledAt);
    dates.orderTableDeliveryEst = dates.scheduledAt;
  }

  if (delivery.scheduled_ends_at && isValidDate(delivery.scheduled_ends_at)) {
    dates.scheduledEndsAt = processDate(delivery.scheduled_ends_at);
    dates.scheduledEndsAtString = generateDateString(dates.scheduledEndsAt);
    dates.orderTableDeliveryEnd = dates.scheduledEndsAt;
  }

  if (delivery.adjusted_date && isValidDate(delivery.adjusted_date)) {
    dates.adjustedDate = processDate(delivery.adjusted_date);
    dates.adjustedDateString = generateDateString(dates.adjustedDate);
    dates.orderTableDeliveryActual = dates.adjustedDate;
  } else if (delivery.completed_at && isValidDate(delivery.completed_at)) {
    dates.adjustedDate = processDate(delivery.completed_at);
    dates.adjustedDateString = generateDateString(dates.adjustedDate);
    dates.orderTableDeliveryActual = dates.adjustedDate;
  } else if (["delivered", "invoiced"].includes(sdOrder.status.toLowerCase())) {
    dates.adjustedDate = DateTime.now();
    dates.adjustedDateString = generateDateString(dates.adjustedDate);
    dates.orderTableDeliveryActual = dates.adjustedDate;
  }

  return dates;
}

// ============================================================================
// ADDRESS PROCESSING
// ============================================================================

function processPickupAddress(
  sdOrder: SuperDispatchOrder,
  existingOrder: IOrder,
): Partial<IOrder["origin"]> {
  const venue = sdOrder.pickup?.venue;
  const isWithheld = isWithheldAddress(existingOrder.origin?.address?.address);
  const isPartialOrder = existingOrder.tmsPartialOrder === true;

  const sdAddressRemoved = !venue || venue.address == null;
  const sdCityRemoved = !venue || venue.city == null;
  const sdStateRemoved = !venue || venue.state == null;
  const sdZipRemoved = !venue || venue.zip == null;

  return {
    // Preserve name/contact if tmsPartialOrder is true or venue is missing
    contact: {
      name:
        isPartialOrder || !venue
          ? existingOrder.origin?.contact?.name
          : venue.contact_name || undefined,
      phone:
        isPartialOrder || !venue
          ? existingOrder.origin?.contact?.phone
          : venue.contact_phone || undefined,
      phoneMobile:
        isPartialOrder || !venue
          ? existingOrder.origin?.contact?.phoneMobile
          : venue.contact_mobile_phone || undefined,
    },
    // Preserve existing address if WITTHELD, tmsPartialOrder, or SD removed it
    address: {
      address:
        isPartialOrder || isWithheld || sdAddressRemoved
          ? existingOrder.origin?.address?.address
          : venue?.address || undefined,
      city:
        isWithheld || sdCityRemoved
          ? existingOrder.origin?.address?.city
          : venue?.city || undefined,
      state:
        isWithheld || sdStateRemoved
          ? existingOrder.origin?.address?.state
          : venue?.state || undefined,
      zip:
        isWithheld || sdZipRemoved
          ? existingOrder.origin?.address?.zip
          : venue?.zip?.replace(/\D+/g, "") || undefined,
    },
    notes: sdOrder.pickup.notes || undefined,
    longitude: sdOrder.pickup.longitude || undefined,
    latitude: sdOrder.pickup.latitude || undefined,
  };
}

function processDeliveryAddress(
  sdOrder: SuperDispatchOrder,
  existingOrder: IOrder,
): Partial<IOrder["destination"]> {
  const venue = sdOrder.delivery?.venue;
  const isWithheld = isWithheldAddress(
    existingOrder.destination?.address?.address,
  );
  const isPartialOrder = existingOrder.tmsPartialOrder === true;

  const sdAddressRemoved = !venue || venue.address == null;
  const sdCityRemoved = !venue || venue.city == null;
  const sdStateRemoved = !venue || venue.state == null;
  const sdZipRemoved = !venue || venue.zip == null;

  return {
    // Preserve name/contact if tmsPartialOrder is true or venue is missing
    contact: {
      name:
        isPartialOrder || !venue
          ? existingOrder.destination?.contact?.name
          : venue.contact_name || undefined,
      phone:
        isPartialOrder || !venue
          ? existingOrder.destination?.contact?.phone
          : venue.contact_phone || undefined,
      phoneMobile:
        isPartialOrder || !venue
          ? existingOrder.destination?.contact?.phoneMobile
          : venue.contact_mobile_phone || undefined,
    },
    // Preserve existing address if WITTHELD, tmsPartialOrder, or SD removed it
    address: {
      address:
        isPartialOrder || isWithheld || sdAddressRemoved
          ? existingOrder.destination?.address?.address
          : venue?.address || undefined,
      city:
        isWithheld || sdCityRemoved
          ? existingOrder.destination?.address?.city
          : venue?.city || undefined,
      state:
        isWithheld || sdStateRemoved
          ? existingOrder.destination?.address?.state
          : venue?.state || undefined,
      zip:
        isWithheld || sdZipRemoved
          ? existingOrder.destination?.address?.zip
          : venue?.zip?.replace(/\D+/g, "") || undefined,
    },
    notes: sdOrder.delivery.notes || undefined,
    longitude: sdOrder.delivery.longitude || undefined,
    latitude: sdOrder.delivery.latitude || undefined,
  };
}

// ============================================================================
// VEHICLE PROCESSING
// ============================================================================

function findMatchingVehicle(
  sdVehicle: SuperDispatchOrder["vehicles"][0],
  existingVehicles: IOrder["vehicles"],
) {
  return existingVehicles.find(
    (existingVehicle) =>
      (existingVehicle.make &&
        sdVehicle.make &&
        existingVehicle.make.toLowerCase() === sdVehicle.make.toLowerCase()) ||
      (existingVehicle.model &&
        sdVehicle.model &&
        existingVehicle.model.toLowerCase() === sdVehicle.model.toLowerCase()),
  );
}

const mapSdVehicleType = (type?: string | null) => {
  const normalized = String(type || "")
    .toLowerCase()
    .trim();
  const typeMap: Record<string, string> = {
    sedan: "sedan",
    suv: "suv",
    van: "van",
    "4_door_pickup": "pickup_4_doors",
    "2_door_pickup": "pickup_2_doors",
    pickup: "pickup_4_doors",
    other: "other",
  };
  return typeMap[normalized] || "other";
};

function processExistingVehicle(
  sdVehicle: SuperDispatchOrder["vehicles"][0],
  savedVehicle: IOrder["vehicles"][0],
  orderCommission: number,
  orderCompanyTariff: number,
) {
  let updatedBaseQuote: number | null = null;

  // If Super's pricing does not equal the database amt, update the base quote
  if (savedVehicle.pricing.total !== sdVehicle.tariff) {
    const superPricingDifference =
      savedVehicle.pricing.total - sdVehicle.tariff;
    updatedBaseQuote =
      (savedVehicle.pricing.base || 0) - superPricingDifference;
  }

  const price = savedVehicle.pricing;
  const commission = price.modifiers?.commission || orderCommission || 0;
  const cTariff = price.modifiers?.companyTariff || orderCompanyTariff || 0;
  const totalValue = sdVehicle.tariff;

  return {
    tariff: sdVehicle.tariff,
    // Always use Super Dispatch VIN if available, otherwise preserve original
    vin:
      sdVehicle.vin !== undefined && sdVehicle.vin !== null
        ? sdVehicle.vin
        : savedVehicle.vin !== undefined && savedVehicle.vin !== null
          ? savedVehicle.vin
          : undefined,
    // Always use Super Dispatch year if available, otherwise preserve original
    year:
      sdVehicle.year !== undefined && sdVehicle.year !== null
        ? sdVehicle.year
        : savedVehicle.year !== undefined && savedVehicle.year !== null
          ? savedVehicle.year
          : undefined,
    pricingClass: mapSdVehicleType(sdVehicle.type),
    make: sdVehicle.make,
    model: sdVehicle.model,
    isInoperable: sdVehicle.is_inoperable,
    pricing: {
      base: updatedBaseQuote || price.base || 0,
      modifiers: {
        ...price.modifiers,
        companyTariff: cTariff,
        commission,
      },
      // Always update pricing from Super Dispatch
      total: totalValue,
      totalWithCompanyTariffAndCommission: totalValue + commission + cTariff,
    },
  };
}

function processNewVehicle(
  sdVehicle: SuperDispatchOrder["vehicles"][0],
  orderCommission: number,
  orderCompanyTariff: number,
) {
  const commission = orderCommission || 0;
  const cTariff = orderCompanyTariff || 0;
  const totalValue = sdVehicle.tariff;

  return {
    tariff: sdVehicle.tariff,
    // Use Super Dispatch VIN if available, otherwise undefined
    vin:
      sdVehicle.vin !== undefined && sdVehicle.vin !== null
        ? sdVehicle.vin
        : undefined,
    // Use Super Dispatch year if available, otherwise undefined
    year:
      sdVehicle.year !== undefined && sdVehicle.year !== null
        ? sdVehicle.year
        : undefined,
    pricingClass: mapSdVehicleType(sdVehicle.type),
    make: sdVehicle.make,
    model: sdVehicle.model,
    isInoperable: sdVehicle.is_inoperable,
    pricing: {
      base: sdVehicle.tariff,
      modifiers: {
        inoperable: 0,
        routes: 0,
        states: 0,
        oversize: 0,
        vehicles: 0,
        globalDiscount: 0,
        portalDiscount: 0,
        irr: 0,
        fuel: 0,
        enclosedFlat: 0,
        enclosedPercent: 0,
        commission,
        serviceLevel: 0,
        companyTariff: cTariff,
      },
      // Always update pricing from Super Dispatch
      total: totalValue,
      totalWithCompanyTariffAndCommission: totalValue + commission + cTariff,
    },
  };
}

function processVehicles(
  sdOrder: SuperDispatchOrder,
  existingOrder: IOrder,
  portal: IPortal,
) {
  const vehicles: IOrder["vehicles"] = [];
  let totalSDAmt = 0;
  let totalPortalAmt = 0;
  const orderCommission = existingOrder.totalPricing?.modifiers?.commission || 0;
  const orderCompanyTariff =
    existingOrder.totalPricing?.modifiers?.companyTariff || 0;

  sdOrder.vehicles.forEach((vehicle) => {
    const savedVehicle = findMatchingVehicle(vehicle, existingOrder.vehicles);

    if (savedVehicle) {
      const vehicleData = processExistingVehicle(
        vehicle,
        savedVehicle,
        orderCommission,
        orderCompanyTariff,
      );
      vehicles.push(vehicleData as IOrder["vehicles"][0]);

      totalSDAmt += vehicle.tariff;
      totalPortalAmt += vehicleData.pricing.totalWithCompanyTariffAndCommission;
    } else {
      const vehicleData = processNewVehicle(
        vehicle,
        orderCommission,
        orderCompanyTariff,
      );
      vehicles.push(vehicleData as IOrder["vehicles"][0]);

      totalSDAmt += vehicle.tariff;
      totalPortalAmt += vehicleData.pricing.totalWithCompanyTariffAndCommission;
    }
  });

  return {
    vehicles,
    totalPricing: {
      ...existingOrder.totalPricing,
      total: totalSDAmt,
      totalWithCompanyTariffAndCommission: totalPortalAmt,
    },
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Update order from SuperDispatch data
 */
export const updateOrderFromSD = async (
  superDispatchOrder: SuperDispatchOrder,
  databaseOrder: IOrder,
): Promise<Partial<IOrder> | null> => {
  try {
    if (!superDispatchOrder) {
      return null;
    }

    // Set default portal if not present
    if (!databaseOrder.portalId) {
      logger.warn(
        `Order ${databaseOrder.refId} has no portalId, using default`,
      );
    }

    const portal = (await Portal.findById(
      databaseOrder.portalId,
    ).lean()) as IPortal;
    if (!portal) {
      throw new Error(`Portal not found: ${databaseOrder.portalId}`);
    }

    // Validate that SuperDispatch customer data matches portal contact details
    // Note: DB customer = actual customer (transferee), SuperDispatch customer = portal contact details
    // We validate but don't override either - they serve different purposes
    if (superDispatchOrder.customer) {
      const sdCustomer = superDispatchOrder.customer;
      const portalAny = portal as any;
      const portalContactEmail =
        portalAny.contactEmail && portalAny.contactEmail.trim()
          ? portalAny.contactEmail.trim()
          : "autologistics@mccollisters.com";

      const mismatches: string[] = [];

      if (
        sdCustomer.name &&
        portalAny.companyName &&
        sdCustomer.name.trim().toLowerCase() !==
          portalAny.companyName.trim().toLowerCase()
      ) {
        mismatches.push("company name");
      }

      if (
        sdCustomer.contact_email &&
        sdCustomer.contact_email.trim().toLowerCase() !==
          portalContactEmail.toLowerCase()
      ) {
        mismatches.push("contact email");
      }

      if (
        sdCustomer.contact_name &&
        portalAny.contactFullName &&
        sdCustomer.contact_name.trim().toLowerCase() !==
          portalAny.contactFullName.trim().toLowerCase()
      ) {
        mismatches.push("contact name");
      }

      if (
        sdCustomer.phone &&
        portalAny.companyPhone &&
        sdCustomer.phone.replace(/\D/g, "") !==
          portalAny.companyPhone.replace(/\D/g, "")
      ) {
        mismatches.push("phone");
      }

      // Log mismatch for monitoring but don't change anything
      if (mismatches.length > 0) {
        logger.warn(
          `[Order ${databaseOrder.refId}] SuperDispatch customer data doesn't match portal contact details:`,
          {
            mismatches: mismatches.join(", "),
            sdCustomer: {
              name: sdCustomer.name,
              contact_email: sdCustomer.contact_email,
              contact_name: sdCustomer.contact_name,
              phone: sdCustomer.phone,
            },
            portalContact: {
              companyName: portalAny.companyName,
              contactEmail: portalContactEmail,
              contactFullName: portalAny.contactFullName,
              companyPhone: portalAny.companyPhone,
            },
          },
        );
      }
    }

    // Process dates
    const pickupDates = processPickupDates(superDispatchOrder);
    const deliveryDates = processDeliveryDates(superDispatchOrder);

    // Process addresses
    const pickupAddress = processPickupAddress(
      superDispatchOrder,
      databaseOrder,
    );
    const deliveryAddress = processDeliveryAddress(
      superDispatchOrder,
      databaseOrder,
    );

    // Process vehicles
    const vehicleData = processVehicles(
      superDispatchOrder,
      databaseOrder,
      portal,
    );

    // Determine date types
    const deliveryDateType = ["delivered", "invoiced"].includes(
      superDispatchOrder.status.toLowerCase(),
    )
      ? "exact"
      : superDispatchOrder.delivery.date_type || "estimated";
    const pickupDateType =
      superDispatchOrder.status.toLowerCase() === "picked_up"
        ? "exact"
        : superDispatchOrder.pickup.date_type || "estimated";

    // Get agent name
    const agentName =
      databaseOrder.agents?.length > 0 && databaseOrder.agents[0].name
        ? databaseOrder.agents[0].name
        : undefined;

    // Get purchase order number
    const purchaseOrderNumber =
      superDispatchOrder.purchase_order_number || databaseOrder.reg;

    // Build the complete order update object
    const orderUpdate: Partial<IOrder> = {
      // Basic order info
      status: Status.Booked,
      reg: purchaseOrderNumber,
      tms: {
        guid: superDispatchOrder.guid,
        status: superDispatchOrder.status,
        updatedAt: superDispatchOrder.changed_at
          ? new Date(superDispatchOrder.changed_at)
          : new Date(),
        createdAt: superDispatchOrder.created_at
          ? new Date(superDispatchOrder.created_at)
          : databaseOrder.tms?.createdAt || new Date(),
      },

      // Customer info (preserve existing)
      customer: {
        ...databaseOrder.customer,
        notes:
          superDispatchOrder.customer?.notes || databaseOrder.customer?.notes,
      },

      // Pickup info
      origin: {
        ...databaseOrder.origin,
        ...pickupAddress,
      },

      // Delivery info
      destination: {
        ...databaseOrder.destination,
        ...deliveryAddress,
      },

      // Vehicles and pricing
      vehicles: vehicleData.vehicles,
      totalPricing: vehicleData.totalPricing,

      // Schedule updates
      schedule: {
        ...databaseOrder.schedule,
        pickupEstimated: pickupDates.scheduledAt
          ? [pickupDates.scheduledAt.toJSDate()]
          : databaseOrder.schedule.pickupEstimated,
        deliveryEstimated: deliveryDates.scheduledAt
          ? [deliveryDates.scheduledAt.toJSDate()]
          : databaseOrder.schedule.deliveryEstimated,
        pickupCompleted: pickupDates.adjustedDate
          ? pickupDates.adjustedDate.toJSDate()
          : databaseOrder.schedule.pickupCompleted,
        deliveryCompleted: deliveryDates.adjustedDate
          ? deliveryDates.adjustedDate.toJSDate()
          : databaseOrder.schedule.deliveryCompleted,
      },

      // Preserve existing fields
      portalId: databaseOrder.portalId,
      userId: databaseOrder.userId,
      quoteId: databaseOrder.quoteId,
      miles: databaseOrder.miles,
      transportType:
        databaseOrder.transportType === "WHITEGLOVE"
          ? databaseOrder.transportType
          : (superDispatchOrder.transport_type.toUpperCase() as any),
      agents: databaseOrder.agents,
      driver: databaseOrder.driver,
      hasClaim: databaseOrder.hasClaim,
      tmsPartialOrder: databaseOrder.tmsPartialOrder,
      originalOrderData: databaseOrder.originalOrderData, // Preserve original order data
    };

    return orderUpdate;
  } catch (error) {
    logger.error("Error in updateOrderFromSD:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orderRefId: databaseOrder.refId,
    });
    return null;
  }
};
