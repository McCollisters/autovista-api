import { describe, it, expect, jest } from "@jest/globals";

jest.mock("@/_global/integrations/authenticateSuperDispatch", () => ({
  authenticateSuperDispatch: jest.fn(async () => "fake-token"),
}));

jest.mock("@/core/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

import { resolveCompleteReleaseScheduleDates } from "@/order/integrations/updateSuperWithCompleteOrder";

const buildOrderSchedule = () => ({
  pickupEstimated: [
    new Date("2026-06-17T12:00:00.000Z"),
    new Date("2026-06-18T12:00:00.000Z"),
  ],
  pickupSelected: new Date("2026-06-17T12:00:00.000Z"),
  deliveryEstimated: [
    new Date("2026-06-21T12:00:00.000Z"),
    new Date("2026-06-23T12:00:00.000Z"),
  ],
});

describe("resolveCompleteReleaseScheduleDates", () => {
  it("uses Super Dispatch pickup and delivery windows when they are present", () => {
    const result = resolveCompleteReleaseScheduleDates(
      {
        pickup: {
          scheduled_at: "2026-06-19T08:00:00.000+0000",
          scheduled_ends_at: "2026-06-20T17:00:00.000+0000",
          first_available_pickup_date: "2026-06-17T12:00:00.000+0000",
        },
        delivery: {
          scheduled_at: "2026-06-24T08:00:00.000+0000",
          scheduled_ends_at: "2026-06-26T17:00:00.000+0000",
        },
      },
      { schedule: buildOrderSchedule() } as any,
    );

    expect(result.pickupStartDate).toBe("2026-06-19T08:00:00.000+0000");
    expect(result.pickupEndDate).toBe("2026-06-20T17:00:00.000+0000");
    expect(result.deliveryStartDate).toBe("2026-06-24T08:00:00.000+0000");
    expect(result.deliveryEndDate).toBe("2026-06-26T17:00:00.000+0000");
  });

  it("falls back to Autovista schedule when Super Dispatch has no dates", () => {
    const result = resolveCompleteReleaseScheduleDates(
      { pickup: {}, delivery: {} },
      { schedule: buildOrderSchedule() } as any,
    );

    expect(result.pickupStartDate).toContain("2026-06-17");
    expect(result.pickupEndDate).toContain("2026-06-18");
    expect(result.deliveryStartDate).toContain("2026-06-21");
    expect(result.deliveryEndDate).toContain("2026-06-23");
  });

  it("does not mix a Super Dispatch start date with an Autovista end date", () => {
    const result = resolveCompleteReleaseScheduleDates(
      {
        pickup: {
          scheduled_at: "2026-06-19T08:00:00.000+0000",
        },
        delivery: {},
      },
      { schedule: buildOrderSchedule() } as any,
    );

    expect(result.pickupStartDate).toBe("2026-06-19T08:00:00.000+0000");
    expect(result.pickupEndDate).toBe("2026-06-19T08:00:00.000+0000");
    expect(result.deliveryStartDate).toContain("2026-06-21");
  });
});
