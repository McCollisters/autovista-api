import { DateTime } from "luxon";
import {
  expandSingleDeliveryDateToRange,
  getTransitSpreadDays,
  isSameCalendarDay,
} from "@/order/utils/deliveryDateRange";

const nyDate = (date: Date) =>
  DateTime.fromJSDate(date).setZone("America/New_York").toISODate();

describe("Super Dispatch delivery range preservation", () => {
  it("uses the difference between maximum and minimum transit days", () => {
    expect(getTransitSpreadDays([2, 10])).toBe(8);
  });

  it("expands a single SD delivery date using the transit-time spread", () => {
    const start = DateTime.fromISO("2026-07-01", {
      zone: "America/New_York",
    }).toJSDate();

    const [rangeStart, rangeEnd] = expandSingleDeliveryDateToRange(
      start,
      [2, 10],
    );

    expect(nyDate(rangeStart)).toBe("2026-07-01");
    expect(nyDate(rangeEnd)).toBe("2026-07-09");
  });

  it("recognizes equal SD start and end dates as a single date", () => {
    const start = DateTime.fromISO("2026-07-01T08:00:00", {
      zone: "America/New_York",
    });
    const end = DateTime.fromISO("2026-07-01T17:00:00", {
      zone: "America/New_York",
    });

    expect(isSameCalendarDay(start, end)).toBe(true);
  });

  it("recognizes different SD dates as a real range", () => {
    const start = DateTime.fromISO("2026-07-01", {
      zone: "America/New_York",
    });
    const end = DateTime.fromISO("2026-07-04", {
      zone: "America/New_York",
    });

    expect(isSameCalendarDay(start, end)).toBe(false);
  });
});
