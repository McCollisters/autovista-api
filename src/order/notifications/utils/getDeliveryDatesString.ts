/**
 * Get Delivery Dates String
 *
 * Formats delivery dates for display in notifications
 */

import { IOrder } from "@/_global/models";
import { DateTime } from "luxon";

const TIMEZONE = "America/New_York";

export function getDeliveryDatesString(order: IOrder): string {
  if (
    !order.schedule?.deliveryEstimated ||
    order.schedule.deliveryEstimated.length === 0
  ) {
    return "TBD";
  }

  const dates = order.schedule.deliveryEstimated.map((date) =>
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
