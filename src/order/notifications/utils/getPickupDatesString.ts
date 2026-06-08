/**
 * Get Pickup Dates String
 *
 * Formats pickup dates for display in notifications
 */

import { IOrder } from "@/_global/models";
import { getCustomerPickupWindowEndDate } from "@/quote/utils/customerPickupDate";
import { DateTime } from "luxon";

const TIMEZONE = "America/New_York";

function resolvePickupEndDate(order: IOrder, pickupStart: Date): Date {
  const storedEnd = order.schedule?.pickupEstimated?.[1];
  if (storedEnd) {
    const end = new Date(storedEnd);
    if (
      end.getFullYear() !== pickupStart.getFullYear() ||
      end.getMonth() !== pickupStart.getMonth() ||
      end.getDate() !== pickupStart.getDate()
    ) {
      return end;
    }
  }

  const serviceLevel = Number(
    order.schedule?.serviceLevel ??
      (order as { serviceLevel?: string | number }).serviceLevel,
  );
  if (Number.isFinite(serviceLevel) && serviceLevel > 0) {
    return getCustomerPickupWindowEndDate(pickupStart, serviceLevel);
  }

  return pickupStart;
}

export function getPickupDatesString(order: IOrder): string {
  const pickupStartRaw =
    order.schedule?.pickupEstimated?.[0] ?? order.schedule?.pickupSelected;

  if (!pickupStartRaw) {
    return "TBD";
  }

  const pickupStart = DateTime.fromJSDate(new Date(pickupStartRaw)).setZone(
    TIMEZONE,
  );
  const pickupEnd = DateTime.fromJSDate(
    resolvePickupEndDate(order, new Date(pickupStartRaw)),
  ).setZone(TIMEZONE);

  const startLabel = pickupStart.toLocaleString(DateTime.DATE_MED);
  const endLabel = pickupEnd.toLocaleString(DateTime.DATE_MED);

  if (startLabel === endLabel) {
    return startLabel;
  }

  return `${startLabel} - ${endLabel}`;
}
