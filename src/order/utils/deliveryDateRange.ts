import { DateTime } from "luxon";

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

export function getTransitSpreadDays(
  transitTime: number[] | undefined | null,
): number | null {
  if (!Array.isArray(transitTime) || transitTime.length < 2) return null;
  const minDays = Number(transitTime[0]);
  const maxDays = Number(transitTime[1]);
  if (!Number.isFinite(minDays) || !Number.isFinite(maxDays)) return null;
  const spread = maxDays - minDays;
  if (spread > 0) return spread;
  if (maxDays > 0) return maxDays;
  return null;
}

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

  const end = DateTime.fromJSDate(start)
    .setZone(SCHEDULE_TIMEZONE)
    .plus({ days: 1 })
    .toJSDate();
  return [start, end];
}
