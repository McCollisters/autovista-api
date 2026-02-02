/**
 * Get Pickup Dates String
 *
 * Formats pickup dates for display in notifications
 */

import { IOrder } from "@/_global/models";
import { DateTime } from "luxon";

const TIMEZONE = "America/New_York";

export function getPickupDatesString(order: IOrder): string {
  if (
    !order.schedule?.pickupEstimated ||
    order.schedule.pickupEstimated.length === 0
  ) {
    // Fallback to pickupSelected if estimated dates not available
    if (order.schedule?.pickupSelected) {
      const date = DateTime.fromJSDate(order.schedule.pickupSelected)
        .setZone(TIMEZONE)
        .toLocaleString(DateTime.DATE_MED);
      return date;
    }
    return "TBD";
  }

  const dates = order.schedule.pickupEstimated.map((date) =>
    DateTime.fromJSDate(date)
      .setZone(TIMEZONE)
      .toLocaleString(DateTime.DATE_MED),
  );

  if (dates.length === 1) {
    return dates[0];
  }

  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  if (startDate === endDate) {
    return startDate;
  }

  // Return date range
  return `${startDate} - ${endDate}`;
}
