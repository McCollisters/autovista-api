/**
 * Date Range Calculation Utility
 *
 * Pickup window end uses calendar-day offsets (same as quote embed / customer emails):
 * 1-Day Pickup → start + 1 calendar day, 3-Day → +3, etc.
 */

import { DateTime } from "luxon";

const TIMEZONE = "America/New_York";

export const getDateRanges = (
  pickupStartDate: string | Date,
  serviceLevel: number,
  transitTime: number[],
  _holidayDates: Date[] = [],
): Date[] => {
  const pickupStart = DateTime.fromJSDate(new Date(pickupStartDate)).setZone(
    TIMEZONE,
  );

  const pickupEnd = pickupStart.plus({ days: serviceLevel });

  const deliveryRangeLow = pickupStart.plus({ days: transitTime[0] });
  const deliveryRangeHigh = pickupEnd.plus({ days: transitTime[1] });

  return [
    pickupStart.toUTC().toJSDate(),
    pickupEnd.toUTC().toJSDate(),
    deliveryRangeLow.toUTC().toJSDate(),
    deliveryRangeHigh.toUTC().toJSDate(),
  ];
};
