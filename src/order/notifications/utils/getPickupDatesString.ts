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
      const pickupStart = DateTime.fromJSDate(order.schedule.pickupSelected).setZone(
        TIMEZONE,
      );
      const serviceLevelRaw = order.schedule?.serviceLevel;
      const serviceLevel = Number(serviceLevelRaw);

      if (Number.isFinite(serviceLevel) && serviceLevel > 1) {
        const serviceLevelOffset = serviceLevel - 1;
        let count = 0;
        let pickupEnd = pickupStart;

        while (count < serviceLevelOffset) {
          pickupEnd = pickupEnd.plus({ days: 1 });
          const dayOfWeek = pickupEnd.weekday; // 1 = Monday, 7 = Sunday
          const isWeekend = dayOfWeek === 6 || dayOfWeek === 7;

          if (!isWeekend) {
            count++;
          }
        }

        return `${pickupStart.toLocaleString(DateTime.DATE_MED)} - ${pickupEnd.toLocaleString(DateTime.DATE_MED)}`;
      }

      return pickupStart.toLocaleString(DateTime.DATE_MED);
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

  // Return date range
  return `${dates[0]} - ${dates[dates.length - 1]}`;
}
