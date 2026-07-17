/**
 * Update order from SuperDispatch data
 *
 * This function processes a full Super Dispatch order object and updates the database order.
 * It includes checks to prevent overriding sensitive data from partial orders and withheld addresses.
 */

import { DateTime } from "luxon";
import { IOrder, IPortal, Portal } from "@/_global/models";
import { Status, TransportType, USState, VehicleClass } from "@/_global/enums";
import { logger } from "@/core/logger";
import { isWithheldAddress } from "../utils/checkWithheldAddress";

interface SuperDispatchOrder {
  guid: string;
  status: string;
  created_at: string;
  changed_at: string;
  purchase_order_number?: string;
  transport_type: string;
  /** Some SD responses expose Carrier Pickup Date at order root */
  carrier_pickup_date?: string;
  customer?: {
    name?: string;
    contact_email?: string;
    contact_name?: string;
    phone?: string;
    notes?: string;
  };
  pickup: {
    /** Super Dispatch UI: "Carrier Pickup Date" (carrier / dispatcher updates) */
    carrier_pickup_date?: string;
    carrier_pickup_at?: string;
    carrier_pickup_ends_at?: string;
    /** Often set on new / estimated orders when scheduled_at is absent */
    first_available_pickup_date?: string;
    scheduled_at?: string;
    scheduled_ends_at?: string;
    /** Often populated when carrier sets a firm pickup window (see also carrier_pickup_*) */
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

function processDate(dateString: string | undefined): DateTime | undefined {
  if (!dateString) return undefined;
  try {
    return DateTime.fromISO(dateString).setZone("America/New_York");
  } catch (e) {
    return undefined;
  }
}

function generateDateString(
  dateObj: DateTime | Date | undefined,
): string | null {
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

/** Luxon invalid DateTime → Invalid JS Date breaks Mongoose + Moment; never persist those. */
function luxonToValidJsDate(dt: DateTime | undefined): Date | undefined {
  if (!dt || !dt.isValid) return undefined;
  const d = dt.toJSDate();
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const SCHEDULE_TIMEZONE = "America/New_York";

export function isSameCalendarDay(
  a: DateTime | Date,
  b: DateTime | Date,
): boolean {
  const toNyDate = (value: DateTime | Date) => {
    const dt =
      value instanceof Date
        ? DateTime.fromJSDate(value).setZone(SCHEDULE_TIMEZONE)
        : value.setZone(SCHEDULE_TIMEZONE);
    return dt.isValid ? dt.toISODate() : null;
  };
  const aDay = toNyDate(a);
  const bDay = toNyDate(b);
  return Boolean(aDay && bDay && aDay === bDay);
}

/**
 * Transit window width in days: maxDays - minDays.
 * Customers always see a delivery range; never a single exact date.
 */
export function getTransitSpreadDays(
  transitTime: number[] | undefined | null,
): number | null {
  if (!Array.isArray(transitTime) || transitTime.length < 2) return null;
  const minDays = Number(transitTime[0]);
  const maxDays = Number(transitTime[1]);
  if (!Number.isFinite(minDays) || !Number.isFinite(maxDays)) return null;
  const spread = maxDays - minDays;
  if (spread > 0) return spread;
  // If min === max, still expand by maxDays when positive so we keep a range.
  if (maxDays > 0) return maxDays;
  return null;
}

/**
 * When Super Dispatch supplies a single delivery date (exact / no distinct end),
 * expand it into [start, start + transitSpread] using the order's transit time.
 */
export function expandSingleDeliveryDateToRange(
  start: Date,
  transitTime: number[] | undefined | null,
  existingDeliveryEstimated?: Date[],
): [Date, Date] {
  const spreadDays = getTransitSpreadDays(transitTime);
  if (spreadDays != null) {
    const end = DateTime.fromJSDate(start)
      .setZone(SCHEDULE_TIMEZONE)
      .plus({ days: spreadDays })
      .toJSDate();
    return [start, end];
  }

  // Fallback: preserve prior delivery window width when transit time is missing.
  if (
    Array.isArray(existingDeliveryEstimated) &&
    existingDeliveryEstimated.length > 1 &&
    existingDeliveryEstimated[1]
  ) {
    const oldStart = existingDeliveryEstimated[0]
      ? new Date(existingDeliveryEstimated[0]).getTime()
      : NaN;
    const oldEnd = new Date(existingDeliveryEstimated[1]).getTime();
    if (Number.isFinite(oldStart) && oldEnd > oldStart) {
      return [start, new Date(start.getTime() + (oldEnd - oldStart))];
    }
  }

  // Last resort: 1-day range so customers never see a single date.
  const end = DateTime.fromJSDate(start)
    .setZone(SCHEDULE_TIMEZONE)
    .plus({ days: 1 })
    .toJSDate();
  return [start, end];
}

function isValidDate(dateString: string | undefined): boolean {
  if (!dateString) return false;

  try {
    let date = DateTime.fromISO(dateString);
    if (!date.isValid) {
      const trimmed = dateString.trim();
      const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
      if (ymd) {
        date = DateTime.fromObject(
          {
            year: Number(ymd[1]),
            month: Number(ymd[2]),
            day: Number(ymd[3]),
          },
          { zone: "America/New_York" },
        );
      }
    }
    const minDate = DateTime.fromISO("2000-01-01");
    const maxDate = DateTime.now().plus({ years: 5 });

    return date.isValid && date >= minDate && date <= maxDate;
  } catch (e) {
    return false;
  }
}

/** Pick the pickup start instant Super Dispatch intends for scheduling (Carrier Pickup Date first). */
function resolvePickupStartIso(sdOrder: SuperDispatchOrder): string | undefined {
  const pickup = sdOrder.pickup;
  const pickupAny = pickup as unknown as Record<string, string | undefined>;
  const status = String(sdOrder.status || "").toLowerCase();
  const isTerminalPickup =
    status === "picked_up" ||
    status === "delivered" ||
    status === "invoiced" ||
    status === "order_canceled";

  const candidates: (string | undefined)[] = [
    sdOrder.carrier_pickup_date,
    (sdOrder as unknown as Record<string, string | undefined>).carrierPickupDate,
    pickup.carrier_pickup_date,
    pickupAny.carrierPickupDate,
    pickup.carrier_pickup_at,
    pickupAny.carrierPickupAt,
  ];
  // Before pickup is complete, carrier firm dates often live on adjusted_date or carrier_* only.
  if (!isTerminalPickup) {
    candidates.push(pickup.adjusted_date);
  }
  candidates.push(pickup.scheduled_at, pickup.first_available_pickup_date);

  for (const c of candidates) {
    if (c && isValidDate(c)) {
      return c;
    }
  }
  return undefined;
}

/** Pickup window end: prefer carrier-specific end, then broker scheduled end. */
function resolvePickupEndIso(sdOrder: SuperDispatchOrder): string | undefined {
  const pickup = sdOrder.pickup;
  const pickupAny = pickup as unknown as Record<string, string | undefined>;
  const candidates = [
    pickup.carrier_pickup_ends_at,
    pickupAny.carrierPickupEndsAt,
    pickup.scheduled_ends_at,
  ];
  for (const c of candidates) {
    if (c && isValidDate(c)) {
      return c;
    }
  }
  return undefined;
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

  const pickupStartIso = resolvePickupStartIso(sdOrder);

  if (pickupStartIso) {
    dates.scheduledAt = processDate(pickupStartIso);
    dates.scheduledAtString = generateDateString(dates.scheduledAt);
    dates.orderTablePickupEst = dates.scheduledAt;
  }

  const pickupEndIso = resolvePickupEndIso(sdOrder);
  if (pickupEndIso) {
    dates.scheduledEndsAt = processDate(pickupEndIso);
    dates.scheduledEndsAtString = generateDateString(dates.scheduledEndsAt);
    dates.orderTablePickupEnd = dates.scheduledEndsAt;
  }

  if (pickup.adjusted_date && isValidDate(pickup.adjusted_date)) {
    dates.adjustedDate = processDate(pickup.adjusted_date);
    dates.adjustedDateString = generateDateString(dates.adjustedDate);
    dates.orderTablePickupActual = dates.adjustedDate;
  } else if (
    !["new", "accepted"].includes(sdOrder.status.toLowerCase()) &&
    pickupStartIso
  ) {
    dates.adjustedDate = processDate(pickupStartIso);
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

/**
 * Merge pickup/delivery notes from Super Dispatch with DB. While `tmsPartialOrder` is true,
 * always keep existing DB notes (SD often has none). After full order is in SD, prefer non-empty SD notes.
 * Exported for unit tests.
 */
export function mergePickupDeliveryNotesFromSd(
  isPartialOrder: boolean,
  sdNotes: string | undefined | null,
  existingNotes: string | undefined | null,
): string | undefined {
  if (isPartialOrder) {
    return existingNotes ?? undefined;
  }
  const trimmed = String(sdNotes ?? "").trim();
  if (trimmed) {
    return sdNotes as string;
  }
  return existingNotes ?? undefined;
}

const normalizeUSState = (value?: string | null): USState | undefined => {
  if (!value) return undefined;
  const normalized = String(value).trim().toUpperCase();
  const validStates = Object.values(USState);
  return validStates.includes(normalized as USState)
    ? (normalized as USState)
    : undefined;
};

const hasSdValue = (value: string | null | undefined): value is string =>
  value != null && String(value).trim() !== "";

export function shouldUseSuperDispatchAddressValue(
  sdValue: string | null | undefined,
): boolean {
  return hasSdValue(sdValue) && !isWithheldAddress(sdValue);
}

const normalizeZip = (value?: string | null): string | undefined => {
  if (!shouldUseSuperDispatchAddressValue(value)) {
    return undefined;
  }
  return String(value).replace(/\D+/g, "") || undefined;
};

function processPickupAddress(
  sdOrder: SuperDispatchOrder,
  existingOrder: IOrder,
): Partial<IOrder["origin"]> {
  const venue = sdOrder.pickup?.venue;
  const sdAddress = venue?.address;
  const sdCity = venue?.city;
  const sdState = normalizeUSState(venue?.state);
  const sdZip = normalizeZip(venue?.zip);

  return {
    // Always preserve our DB contact—Super has portal/office contact, not customer
    contact: {
      name: existingOrder.origin?.contact?.name,
      phone: existingOrder.origin?.contact?.phone,
      phoneMobile: existingOrder.origin?.contact?.phoneMobile,
    },
    // Keep withheld/blank SD placeholders out, but allow real SD address edits to flow back.
    address: {
      address: shouldUseSuperDispatchAddressValue(sdAddress)
        ? sdAddress
        : existingOrder.origin?.address?.address,
      city:
        shouldUseSuperDispatchAddressValue(sdCity)
          ? sdCity
          : existingOrder.origin?.address?.city,
      state: sdState || existingOrder.origin?.address?.state,
      zip: sdZip || existingOrder.origin?.address?.zip,
    },
    // While order is still partial in TMS, SD often has no/empty notes; never wipe our DB notes.
    notes: mergePickupDeliveryNotesFromSd(
      existingOrder.tmsPartialOrder === true,
      sdOrder.pickup?.notes,
      existingOrder.origin?.notes,
    ),
    longitude: sdOrder.pickup.longitude || undefined,
    latitude: sdOrder.pickup.latitude || undefined,
  };
}

function processDeliveryAddress(
  sdOrder: SuperDispatchOrder,
  existingOrder: IOrder,
): Partial<IOrder["destination"]> {
  const venue = sdOrder.delivery?.venue;
  const sdAddress = venue?.address;
  const sdCity = venue?.city;
  const sdState = normalizeUSState(venue?.state);
  const sdZip = normalizeZip(venue?.zip);

  return {
    // Always preserve our DB contact—Super has portal/office contact, not customer
    contact: {
      name: existingOrder.destination?.contact?.name,
      phone: existingOrder.destination?.contact?.phone,
      phoneMobile: existingOrder.destination?.contact?.phoneMobile,
    },
    // Keep withheld/blank SD placeholders out, but allow real SD address edits to flow back.
    address: {
      address: shouldUseSuperDispatchAddressValue(sdAddress)
        ? sdAddress
        : existingOrder.destination?.address?.address,
      city:
        shouldUseSuperDispatchAddressValue(sdCity)
          ? sdCity
          : existingOrder.destination?.address?.city,
      state: sdState || existingOrder.destination?.address?.state,
      zip: sdZip || existingOrder.destination?.address?.zip,
    },
    notes: mergePickupDeliveryNotesFromSd(
      existingOrder.tmsPartialOrder === true,
      sdOrder.delivery?.notes,
      existingOrder.destination?.notes,
    ),
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

const mapSdVehicleType = (type?: string | null): VehicleClass => {
  const normalized = String(type || "")
    .toLowerCase()
    .trim();
  const typeMap: Record<string, VehicleClass> = {
    sedan: VehicleClass.Sedan,
    suv: VehicleClass.SUV,
    van: VehicleClass.Van,
    "4_door_pickup": VehicleClass.Pickup4Door,
    "2_door_pickup": VehicleClass.Pickup2Door,
    pickup: VehicleClass.Pickup4Door,
    other: VehicleClass.Other,
  };
  return typeMap[normalized] || VehicleClass.Other;
};

type OrderVehicle = IOrder["vehicles"][0];

const normalizeOrderModifiers = (
  modifiers?: Partial<OrderVehicle["pricing"]["modifiers"]>,
): OrderVehicle["pricing"]["modifiers"] => ({
  inoperable: modifiers?.inoperable ?? 0,
  routes: modifiers?.routes ?? 0,
  states: modifiers?.states ?? 0,
  oversize: modifiers?.oversize ?? 0,
  vehicles: modifiers?.vehicles ?? 0,
  globalDiscount: modifiers?.globalDiscount ?? 0,
  portalDiscount: modifiers?.portalDiscount ?? 0,
  irr: modifiers?.irr ?? 0,
  fuel: modifiers?.fuel ?? 0,
  enclosedFlat: modifiers?.enclosedFlat ?? 0,
  enclosedPercent: modifiers?.enclosedPercent ?? 0,
  commission: modifiers?.commission ?? 0,
  serviceLevels:
    (modifiers as any)?.serviceLevels ?? (modifiers as any)?.serviceLevel ?? [],
  companyTariff: modifiers?.companyTariff ?? 0,
}) as OrderVehicle["pricing"]["modifiers"];

function processExistingVehicle(
  sdVehicle: SuperDispatchOrder["vehicles"][0],
  savedVehicle: IOrder["vehicles"][0],
  orderCommission: number,
  orderCompanyTariff: number,
): OrderVehicle {
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
  const normalizedModifiers = normalizeOrderModifiers(price.modifiers);

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
        ...normalizedModifiers,
        companyTariff: cTariff,
        commission,
      },
      // Always update pricing from Super Dispatch
      total: totalValue,
      totalWithCompanyTariffAndCommission: totalValue + commission + cTariff,
    },
  } as unknown as OrderVehicle;
}

function processNewVehicle(
  sdVehicle: SuperDispatchOrder["vehicles"][0],
  orderCommission: number,
  orderCompanyTariff: number,
): OrderVehicle {
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
        serviceLevels: [],
        companyTariff: cTariff,
      },
      // Always update pricing from Super Dispatch
      total: totalValue,
      totalWithCompanyTariffAndCommission: totalValue + commission + cTariff,
    },
  } as unknown as OrderVehicle;
}

function buildScheduleFromProcessedDates(
  databaseOrder: IOrder,
  pickupDates: ProcessedDates,
  deliveryDates: ProcessedDates,
): IOrder["schedule"] {
  const nextPickupEstimated = (() => {
    if (!pickupDates.scheduledAt) {
      return databaseOrder.schedule.pickupEstimated;
    }
    if (pickupDates.scheduledEndsAt) {
      return [
        pickupDates.scheduledAt.toJSDate(),
        pickupDates.scheduledEndsAt.toJSDate(),
      ];
    }
    const start = pickupDates.scheduledAt.toJSDate();
    const existing = databaseOrder.schedule.pickupEstimated;
    if (Array.isArray(existing) && existing.length > 1 && existing[1]) {
      const oldStart = existing[0] ? new Date(existing[0]).getTime() : NaN;
      const oldEnd = new Date(existing[1]).getTime();
      if (Number.isFinite(oldStart) && oldEnd > oldStart) {
        const spanMs = oldEnd - oldStart;
        return [start, new Date(start.getTime() + spanMs)];
      }
    }
    return [start];
  })();

  const nextDeliveryEstimated = (() => {
    if (!deliveryDates.scheduledAt) {
      return databaseOrder.schedule.deliveryEstimated;
    }

    const start = deliveryDates.scheduledAt.toJSDate();
    const hasDistinctRangeEnd =
      Boolean(deliveryDates.scheduledEndsAt) &&
      !isSameCalendarDay(
        deliveryDates.scheduledAt,
        deliveryDates.scheduledEndsAt!,
      );

    // Super Dispatch provided a real date range — use it as-is.
    if (hasDistinctRangeEnd && deliveryDates.scheduledEndsAt) {
      return [
        start,
        deliveryDates.scheduledEndsAt.toJSDate(),
      ];
    }

    // Exact / single date from SD — always expand to a transit-time range.
    return expandSingleDeliveryDateToRange(
      start,
      databaseOrder.transitTime,
      databaseOrder.schedule.deliveryEstimated,
    );
  })();

  return {
    ...databaseOrder.schedule,
    pickupEstimated: nextPickupEstimated,
    pickupSelected: (() => {
      const fromSd = luxonToValidJsDate(pickupDates.scheduledAt);
      if (fromSd) return fromSd;
      const est0 = Array.isArray(nextPickupEstimated)
        ? nextPickupEstimated[0]
        : undefined;
      if (est0) {
        const d = est0 instanceof Date ? est0 : new Date(est0);
        if (!Number.isNaN(d.getTime())) return d;
      }
      return databaseOrder.schedule.pickupSelected;
    })(),
    deliveryEstimated: nextDeliveryEstimated,
    pickupCompleted:
      luxonToValidJsDate(pickupDates.adjustedDate) ??
      databaseOrder.schedule.pickupCompleted,
    deliveryCompleted:
      luxonToValidJsDate(deliveryDates.adjustedDate) ??
      databaseOrder.schedule.deliveryCompleted,
  };
}

function processVehicles(
  sdOrder: SuperDispatchOrder,
  existingOrder: IOrder,
  _portal: IPortal,
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
      vehicles.push(vehicleData);

      totalSDAmt += vehicle.tariff;
      totalPortalAmt += vehicleData.pricing.totalWithCompanyTariffAndCommission;
    } else {
      const vehicleData = processNewVehicle(
        vehicle,
        orderCommission,
        orderCompanyTariff,
      );
      vehicles.push(vehicleData);

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
 * Sync schedule dates, vehicles, and TMS metadata from Super Dispatch without
 * touching addresses, customer, or order status. Safe while `tmsPartialOrder`
 * is true (addresses remain withheld in SD).
 */
export const updateOrderScheduleAndVehiclesFromSD = async (
  superDispatchOrder: SuperDispatchOrder,
  databaseOrder: IOrder,
): Promise<Partial<IOrder> | null> => {
  try {
    if (!superDispatchOrder) {
      return null;
    }

    const portal = await Portal.findById(databaseOrder.portalId)
      .lean<IPortal | null>()
      .exec();
    if (!portal) {
      throw new Error(`Portal not found: ${databaseOrder.portalId}`);
    }

    const pickupDates = processPickupDates(superDispatchOrder);
    const deliveryDates = processDeliveryDates(superDispatchOrder);
    const vehicleData = processVehicles(
      superDispatchOrder,
      databaseOrder,
      portal,
    );

    return {
      vehicles: vehicleData.vehicles,
      totalPricing: vehicleData.totalPricing,
      schedule: buildScheduleFromProcessedDates(
        databaseOrder,
        pickupDates,
        deliveryDates,
      ),
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
      tmsPartialOrder: databaseOrder.tmsPartialOrder,
    };
  } catch (error) {
    logger.error("Error in updateOrderScheduleAndVehiclesFromSD:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orderRefId: databaseOrder.refId,
    });
    return null;
  }
};

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

    const portal = await Portal.findById(databaseOrder.portalId)
      .lean<IPortal | null>()
      .exec();
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

    const scheduleUpdate = buildScheduleFromProcessedDates(
      databaseOrder,
      pickupDates,
      deliveryDates,
    );

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

      // Schedule updates (pickupSelected must track SD window start — UI maps pickupScheduledAt from it)
      schedule: scheduleUpdate,

      // Preserve existing fields
      portalId: databaseOrder.portalId,
      userId: databaseOrder.userId,
      quoteId: databaseOrder.quoteId,
      miles: databaseOrder.miles,
      transportType: (() => {
        const currentTransportType = String(
          databaseOrder.transportType || "",
        ).toLowerCase();

        // Preserve WhiteGlove transport type regardless of SD value
        if (currentTransportType === TransportType.WhiteGlove) {
          return TransportType.WhiteGlove;
        }

        // Only update transportType from Super Dispatch if it's a valid value
        const sdTransportType = String(
          superDispatchOrder.transport_type || "",
        )
          .toLowerCase()
          .trim();
        const validTransportTypes = Object.values(TransportType);

        if (
          sdTransportType &&
          validTransportTypes.includes(sdTransportType as TransportType)
        ) {
          // Only update if it's different from the current value
          if (sdTransportType !== currentTransportType) {
            logger.info("Updating transportType from Super Dispatch", {
              orderRefId: databaseOrder.refId,
              oldTransportType: databaseOrder.transportType,
              newTransportType: sdTransportType,
            });
            return sdTransportType as TransportType;
          }
        }

        // Preserve existing transportType if Super Dispatch value is invalid or missing
        return databaseOrder.transportType as TransportType;
      })(),
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
