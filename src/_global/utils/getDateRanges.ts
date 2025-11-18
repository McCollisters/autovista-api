/**
 * Date Range Calculation Utility
 *
 * This utility calculates pickup and delivery date ranges based on service level and holidays
 */

import { DateTime } from "luxon";

const TIMEZONE = "America/New_York";

export const getDateRanges = (
  pickupStartDate: string | Date,
  serviceLevel: number,
  transitTime: number[],
  holidayDates: Date[] = [],
): Date[] => {
  let pickupStart = DateTime.fromJSDate(new Date(pickupStartDate)).setZone(
    TIMEZONE,
  );

  const holidayStrings = holidayDates.map((holiday) =>
    DateTime.fromJSDate(new Date(holiday)).setZone(TIMEZONE).toISODate(),
  );

  const serviceLevelOffset = serviceLevel - 1;
  let count = 0;

  let pickupEnd = pickupStart;

  while (count < serviceLevelOffset) {
    pickupEnd = pickupEnd.plus({ days: 1 });

    const dayOfWeek = pickupEnd.weekday; // 1 = Monday, 7 = Sunday
    const pickupEndStr = pickupEnd.toISODate();

    const isWeekend = dayOfWeek === 6 || dayOfWeek === 7;

    if (!isWeekend && !holidayStrings.includes(pickupEndStr)) {
      count++;
    }
  }

  const deliveryRangeLow = pickupStart.plus({ days: transitTime[0] });
  const deliveryRangeHigh = pickupEnd.plus({ days: transitTime[1] });

  return [
    pickupStart.toUTC().toJSDate(),
    pickupEnd.toUTC().toJSDate(),
    deliveryRangeLow.toUTC().toJSDate(),
    deliveryRangeHigh.toUTC().toJSDate(),
  ];
};
