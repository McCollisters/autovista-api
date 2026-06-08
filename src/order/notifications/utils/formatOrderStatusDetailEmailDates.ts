/**
 * Pickup/delivery labels and value lines for customer emails — aligned with
 * mc_portal_react OrderStatusDetail (MM.DD.YYYY dot dates, parentheticals, White Glove, service level 1).
 */

import type { IOrder } from "@/_global/models";
import {
  formatEmbedDateDot,
  formatEmbedDateRange,
  getCustomerPickupWindowEndDate,
  isSameCalendarDay,
} from "@/quote/utils/customerPickupDate";

function normalizeDateTypeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function formatDateDot(date: Date): string {
  return formatEmbedDateDot(date) ?? "—";
}

function resolvePickupWindowServiceLevel(order: IOrder): number | null {
  const raw =
    (order.schedule as { serviceLevel?: string | number } | undefined)
      ?.serviceLevel ?? (order as { serviceLevel?: string | number }).serviceLevel;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveCustomerPickupEnd(
  start: Date,
  end: Date | null,
  serviceLevel: number | null,
): Date | null {
  if (!serviceLevel) {
    return end;
  }
  if (!end || isSameCalendarDay(start, end)) {
    return getCustomerPickupWindowEndDate(start, serviceLevel);
  }
  return end;
}

function getPickupStartEnd(order: IOrder): { start: Date | null; end: Date | null } {
  const serviceLevel = resolvePickupWindowServiceLevel(order);
  const p = (order as { pickup?: Record<string, unknown> }).pickup;
  if (p?.pickupScheduledAt) {
    const start = new Date(p.pickupScheduledAt as string | Date);
    const endRaw = p.pickupScheduledEndsAt
      ? new Date(p.pickupScheduledEndsAt as string | Date)
      : null;
    return {
      start,
      end: resolveCustomerPickupEnd(start, endRaw, serviceLevel),
    };
  }
  const sch = order.schedule;
  const startRaw = sch?.pickupEstimated?.[0] ?? sch?.pickupSelected ?? null;
  const endRaw = sch?.pickupEstimated?.[1] ?? null;
  const start = startRaw ? new Date(startRaw) : null;
  const end = start
    ? resolveCustomerPickupEnd(
        start,
        endRaw ? new Date(endRaw) : null,
        serviceLevel,
      )
    : null;
  return { start, end };
}

function getDeliveryStartEnd(order: IOrder): { start: Date | null; end: Date | null } {
  const d = (order as { delivery?: Record<string, unknown> }).delivery;
  if (d?.deliveryScheduledAt) {
    return {
      start: new Date(d.deliveryScheduledAt as string | Date),
      end: d.deliveryScheduledEndsAt
        ? new Date(d.deliveryScheduledEndsAt as string | Date)
        : null,
    };
  }
  const de = order.schedule?.deliveryEstimated;
  if (!de?.length) {
    return { start: null, end: null };
  }
  const start = new Date(de[0]);
  const end = de.length > 1 ? new Date(de[de.length - 1]) : new Date(de[0]);
  return { start, end };
}

export function formatOrderStatusDetailEmailDates(order: IOrder): {
  pickupDetailLabel: string;
  pickupDetailDisplay: string;
  deliveryDetailLabel: string;
  deliveryDetailDisplay: string;
} {
  const pickupDt = normalizeDateTypeKey(
    (order as { pickup?: { pickupDateType?: string } }).pickup?.pickupDateType,
  );
  let pickupDateTypeString: string;
  if (pickupDt === "exact") {
    pickupDateTypeString = "Exact";
  } else if (pickupDt === "not_earlier_than") {
    pickupDateTypeString = "Not Earlier Than";
  } else {
    pickupDateTypeString = "Estimated";
  }

  const deliveryDt = normalizeDateTypeKey(
    (order as { delivery?: { deliveryDateType?: string } }).delivery
      ?.deliveryDateType,
  );
  let deliveryDateTypeString: string;
  if (deliveryDt === "exact") {
    deliveryDateTypeString = "Exact";
  } else if (deliveryDt === "not_earlier_than") {
    deliveryDateTypeString = "Not Earlier Than";
  } else {
    deliveryDateTypeString = "Estimated";
  }

  const deliveryRangeParenthetical =
    deliveryDateTypeString === "Estimated"
      ? "Estimated range based on transit time"
      : deliveryDateTypeString;

  const transportTypeOs = String(order.transportType || "").toLowerCase();
  const isWhiteGlove =
    transportTypeOs === "whiteglove" || transportTypeOs === "white glove";

  const pickupRangeParenthetical = isWhiteGlove
    ? null
    : pickupDateTypeString || null;

  const { start: puStart, end: puEnd } = getPickupStartEnd(order);
  const { start: delStart, end: delEnd } = getDeliveryStartEnd(order);

  const pickupDetailLabel = isWhiteGlove ? "Pickup Estimate" : "Pickup";

  let pickupDetailDisplay: string;
  if (isWhiteGlove) {
    pickupDetailDisplay = puStart ? formatDateDot(puStart) : "—";
  } else if (!puStart) {
    pickupDetailDisplay = "—";
  } else {
    let line: string;
    if (
      puStart &&
      puEnd &&
      !isSameCalendarDay(puStart, puEnd) &&
      pickupDateTypeString &&
      pickupDateTypeString !== "Exact" &&
      pickupDateTypeString !== "Not Earlier Than"
    ) {
      line = formatEmbedDateRange(puStart, puEnd) ?? formatDateDot(puStart);
    } else {
      line = formatDateDot(puStart);
    }
    if (pickupRangeParenthetical) {
      line += ` (${pickupRangeParenthetical})`;
    }
    pickupDetailDisplay = line;
  }

  const deliveryDetailLabel = "Delivery";

  let deliveryDetailDisplay: string;
  if (!delStart) {
    deliveryDetailDisplay = "—";
  } else {
    let line: string;
    if (delEnd) {
      line = formatEmbedDateRange(delStart, delEnd) ?? formatDateDot(delStart);
    } else {
      line = formatDateDot(delStart);
    }
    if (deliveryRangeParenthetical) {
      line += ` (${deliveryRangeParenthetical})`;
    }
    deliveryDetailDisplay = line;
  }

  return {
    pickupDetailLabel,
    pickupDetailDisplay,
    deliveryDetailLabel,
    deliveryDetailDisplay,
  };
}
