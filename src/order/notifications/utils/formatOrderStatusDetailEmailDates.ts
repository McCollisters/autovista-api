/**
 * Pickup/delivery labels and value lines for customer emails.
 * Mirrors mc_portal_react OrderStatusDetail transform + formatPickupDisplayDot.
 */

import type { IOrder } from "@/_global/models";
import {
  formatEmbedDateDot,
  formatEmbedDateRange,
  resolvePickupScheduledEnd,
} from "@/quote/utils/customerPickupDate";

function normalizeDateTypeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/** Same as OrderStatusDetail.formatPickupDisplayDot */
function formatPickupDisplayDot(
  pickupScheduledAt: Date | null,
  pickupScheduledEndsAt: Date | null,
  showAsSingleDay: boolean,
): string {
  if (!pickupScheduledAt) {
    return "—";
  }
  if (!showAsSingleDay && pickupScheduledEndsAt) {
    return (
      formatEmbedDateRange(pickupScheduledAt, pickupScheduledEndsAt) ||
      formatEmbedDateDot(pickupScheduledAt) ||
      "—"
    );
  }
  return formatEmbedDateDot(pickupScheduledAt) || "—";
}

function resolvePickupDates(order: IOrder): {
  pickupScheduledAt: Date | null;
  pickupScheduledEndsAt: Date | null;
} {
  const pickupStartRaw =
    order.schedule?.pickupEstimated?.[0] ??
    order.schedule?.pickupSelected ??
    null;
  const pickupEndRaw =
    order.schedule?.pickupEstimated?.[1] ??
    order.schedule?.pickupEstimated?.[0] ??
    null;
  const pickupServiceLevel =
    order.schedule?.serviceLevel ??
    (order as { serviceLevel?: string | number }).serviceLevel ??
    null;

  if (!pickupStartRaw) {
    return { pickupScheduledAt: null, pickupScheduledEndsAt: null };
  }

  const pickupScheduledAt = new Date(pickupStartRaw);
  const pickupScheduledEndsAt = resolvePickupScheduledEnd(
    pickupScheduledAt,
    pickupEndRaw ? new Date(pickupEndRaw) : null,
    pickupServiceLevel,
  );

  return { pickupScheduledAt, pickupScheduledEndsAt };
}

function resolveDeliveryDates(order: IOrder): {
  deliveryScheduledAt: Date | null;
  deliveryScheduledEndsAt: Date | null;
} {
  const deliveryStartRaw = order.schedule?.deliveryEstimated?.[0] ?? null;
  const deliveryEndRaw =
    order.schedule?.deliveryEstimated?.[1] ??
    order.schedule?.deliveryEstimated?.[0] ??
    null;

  if (!deliveryStartRaw) {
    return { deliveryScheduledAt: null, deliveryScheduledEndsAt: null };
  }

  return {
    deliveryScheduledAt: new Date(deliveryStartRaw),
    deliveryScheduledEndsAt: deliveryEndRaw ? new Date(deliveryEndRaw) : null,
  };
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

  const { pickupScheduledAt, pickupScheduledEndsAt } = resolvePickupDates(order);
  const { deliveryScheduledAt, deliveryScheduledEndsAt } =
    resolveDeliveryDates(order);

  const pickupDetailLabel = isWhiteGlove ? "Pickup Estimate" : "Pickup";

  let pickupDetailDisplay: string;
  if (isWhiteGlove) {
    pickupDetailDisplay = pickupScheduledAt
      ? formatEmbedDateDot(pickupScheduledAt) || "—"
      : "—";
  } else {
    const pickupLine = formatPickupDisplayDot(
      pickupScheduledAt,
      pickupScheduledEndsAt,
      pickupDateTypeString === "Exact" ||
        pickupDateTypeString === "Not Earlier Than",
    );
    pickupDetailDisplay = pickupRangeParenthetical
      ? `${pickupLine} (${pickupRangeParenthetical})`
      : pickupLine;
  }

  const deliveryDetailLabel = "Delivery";

  let deliveryDetailDisplay: string;
  if (!deliveryScheduledAt) {
    deliveryDetailDisplay = "—";
  } else {
    let deliveryLine: string;
    if (deliveryScheduledEndsAt) {
      deliveryLine =
        formatEmbedDateRange(deliveryScheduledAt, deliveryScheduledEndsAt) ||
        formatEmbedDateDot(deliveryScheduledAt) ||
        "—";
    } else {
      deliveryLine = formatEmbedDateDot(deliveryScheduledAt) || "—";
    }
    deliveryDetailDisplay = deliveryRangeParenthetical
      ? `${deliveryLine} (${deliveryRangeParenthetical})`
      : deliveryLine;
  }

  return {
    pickupDetailLabel,
    pickupDetailDisplay,
    deliveryDetailLabel,
    deliveryDetailDisplay,
  };
}
