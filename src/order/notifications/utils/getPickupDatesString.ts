/**
 * Get Pickup Dates String
 *
 * Formats pickup dates for display in notifications
 */

import { IOrder } from "@/_global/models";
import {
  formatEmbedDateDot,
  formatEmbedDateRange,
  resolvePickupScheduledEnd,
} from "@/quote/utils/customerPickupDate";

export function getPickupDatesString(order: IOrder): string {
  const pickupStartRaw =
    order.schedule?.pickupEstimated?.[0] ?? order.schedule?.pickupSelected;

  if (!pickupStartRaw) {
    return "TBD";
  }

  const pickupEndRaw =
    order.schedule?.pickupEstimated?.[1] ??
    order.schedule?.pickupEstimated?.[0] ??
    null;
  const serviceLevel =
    order.schedule?.serviceLevel ??
    (order as { serviceLevel?: string | number }).serviceLevel ??
    null;

  const pickupStart = new Date(pickupStartRaw);
  const pickupEnd = resolvePickupScheduledEnd(
    pickupStart,
    pickupEndRaw ? new Date(pickupEndRaw) : null,
    serviceLevel,
  );

  if (!pickupEnd) {
    return formatEmbedDateDot(pickupStart) || "TBD";
  }

  return (
    formatEmbedDateRange(pickupStart, pickupEnd) ||
    formatEmbedDateDot(pickupStart) ||
    "TBD"
  );
}
