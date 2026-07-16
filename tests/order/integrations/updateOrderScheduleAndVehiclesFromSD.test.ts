import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { DateTime } from "luxon";
import { updateOrderScheduleAndVehiclesFromSD } from "@/order/integrations/updateOrderFromSD";

jest.mock("@/_global/models", () => ({
  Portal: {
    findById: jest.fn(),
  },
}));

jest.mock("@/core/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const { Portal } = require("@/_global/models");

const nyIsoDate = (date: Date) =>
  DateTime.fromJSDate(date).setZone("America/New_York").toISODate();

describe("updateOrderScheduleAndVehiclesFromSD", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Portal.findById.mockReturnValue({
      lean: () => ({
        exec: () => Promise.resolve({ _id: "portal-id", companyName: "Test" }),
      }),
    });
  });

  it("syncs schedule dates and vehicles without origin/destination", async () => {
    const databaseOrder = {
      refId: "12345",
      portalId: "portal-id",
      tmsPartialOrder: true,
      transitTime: [2, 10],
      schedule: {
        pickupEstimated: [new Date("2026-06-17T12:00:00.000Z")],
        pickupSelected: new Date("2026-06-17T12:00:00.000Z"),
        deliveryEstimated: [new Date("2026-06-21T12:00:00.000Z")],
      },
      origin: {
        address: { address: "123 Main St", city: "Austin", state: "TX" },
        notes: "Pickup gate code",
      },
      destination: {
        address: { address: "456 Oak Ave", city: "Dallas", state: "TX" },
      },
      vehicles: [
        {
          make: "Toyota",
          model: "Camry",
          vin: "VIN123",
          year: "2020",
          isInoperable: false,
          pricingClass: "sedan",
          pricing: {
            base: 500,
            total: 500,
            totalWithCompanyTariffAndCommission: 500,
            modifiers: { commission: 0, companyTariff: 0 },
          },
        },
      ],
      totalPricing: {
        total: 500,
        totalWithCompanyTariffAndCommission: 500,
        modifiers: { commission: 0, companyTariff: 0 },
      },
    };

    const superDispatchOrder = {
      guid: "sd-guid",
      status: "new",
      created_at: "2026-06-01T10:00:00.000Z",
      changed_at: "2026-06-10T15:30:00.000Z",
      transport_type: "open",
      pickup: {
        scheduled_at: "2026-06-18",
        scheduled_ends_at: "2026-06-20",
        date_type: "estimated",
        venue: { address: null, city: null, state: null, zip: null },
      },
      delivery: {
        scheduled_at: "2026-06-21",
        scheduled_ends_at: "2026-07-04",
        date_type: "estimated",
        venue: { address: null, city: null, state: null, zip: null },
      },
      vehicles: [
        {
          make: "Toyota",
          model: "Camry",
          vin: null,
          year: "2021",
          is_inoperable: true,
          type: "sedan",
          tariff: 550,
        },
      ],
    };

    const result = await updateOrderScheduleAndVehiclesFromSD(
      superDispatchOrder as any,
      databaseOrder as any,
    );

    expect(result).not.toBeNull();
    expect(result?.origin).toBeUndefined();
    expect(result?.destination).toBeUndefined();
    expect(result?.status).toBeUndefined();
    expect(result?.tmsPartialOrder).toBe(true);
    expect(result?.tms?.status).toBe("new");
    expect(result?.vehicles?.[0]?.year).toBe("2021");
    expect(result?.vehicles?.[0]?.vin).toBe("VIN123");
    expect(result?.vehicles?.[0]?.isInoperable).toBe(true);
    expect(result?.schedule?.pickupEstimated?.[0]).toBeInstanceOf(Date);
    expect(result?.schedule?.deliveryEstimated?.[1]).toBeInstanceOf(Date);
  });

  it("uses Super Dispatch delivery range when start and end differ", async () => {
    const databaseOrder = {
      refId: "12345",
      portalId: "portal-id",
      tmsPartialOrder: true,
      transitTime: [2, 10],
      schedule: {
        pickupEstimated: [
          new Date("2026-06-17T12:00:00.000Z"),
          new Date("2026-06-19T12:00:00.000Z"),
        ],
        pickupSelected: new Date("2026-06-17T12:00:00.000Z"),
        deliveryEstimated: [
          new Date("2026-06-21T12:00:00.000Z"),
          new Date("2026-07-01T12:00:00.000Z"),
        ],
      },
      vehicles: [],
      totalPricing: {
        total: 0,
        totalWithCompanyTariffAndCommission: 0,
        modifiers: { commission: 0, companyTariff: 0 },
      },
    };

    const superDispatchOrder = {
      guid: "sd-guid",
      status: "accepted",
      created_at: "2026-06-01T10:00:00.000Z",
      changed_at: "2026-06-10T15:30:00.000Z",
      transport_type: "open",
      pickup: {
        scheduled_at: "2026-06-18",
        scheduled_ends_at: "2026-06-20",
        venue: {},
      },
      delivery: {
        scheduled_at: "2026-06-25",
        scheduled_ends_at: "2026-07-04",
        date_type: "estimated",
        venue: {},
      },
      vehicles: [],
    };

    const result = await updateOrderScheduleAndVehiclesFromSD(
      superDispatchOrder as any,
      databaseOrder as any,
    );

    expect(nyIsoDate(result!.schedule!.deliveryEstimated![0] as Date)).toBe(
      "2026-06-25",
    );
    expect(nyIsoDate(result!.schedule!.deliveryEstimated![1] as Date)).toBe(
      "2026-07-04",
    );
  });

  it("expands a single Super Dispatch delivery date using transit time", async () => {
    const databaseOrder = {
      refId: "12345",
      portalId: "portal-id",
      tmsPartialOrder: true,
      transitTime: [2, 10],
      schedule: {
        pickupEstimated: [
          new Date("2026-06-17T12:00:00.000Z"),
          new Date("2026-06-19T12:00:00.000Z"),
        ],
        pickupSelected: new Date("2026-06-17T12:00:00.000Z"),
        deliveryEstimated: [
          new Date("2026-06-21T12:00:00.000Z"),
          new Date("2026-07-01T12:00:00.000Z"),
        ],
      },
      vehicles: [],
      totalPricing: {
        total: 0,
        totalWithCompanyTariffAndCommission: 0,
        modifiers: { commission: 0, companyTariff: 0 },
      },
    };

    const superDispatchOrder = {
      guid: "sd-guid",
      status: "accepted",
      created_at: "2026-06-01T10:00:00.000Z",
      changed_at: "2026-06-10T15:30:00.000Z",
      transport_type: "open",
      pickup: {
        scheduled_at: "2026-06-18",
        scheduled_ends_at: "2026-06-20",
        venue: {},
      },
      delivery: {
        scheduled_at: "2026-07-01",
        date_type: "exact",
        venue: {},
      },
      vehicles: [],
    };

    const result = await updateOrderScheduleAndVehiclesFromSD(
      superDispatchOrder as any,
      databaseOrder as any,
    );

    // transitTime [2, 10] → spread 8 days → July 1–July 9
    expect(nyIsoDate(result!.schedule!.deliveryEstimated![0] as Date)).toBe(
      "2026-07-01",
    );
    expect(nyIsoDate(result!.schedule!.deliveryEstimated![1] as Date)).toBe(
      "2026-07-09",
    );
  });

  it("expands when Super Dispatch start and end are the same calendar day", async () => {
    const databaseOrder = {
      refId: "12345",
      portalId: "portal-id",
      tmsPartialOrder: true,
      transitTime: [1, 3],
      schedule: {
        pickupEstimated: [new Date("2026-06-17T12:00:00.000Z")],
        pickupSelected: new Date("2026-06-17T12:00:00.000Z"),
        deliveryEstimated: [
          new Date("2026-06-21T12:00:00.000Z"),
          new Date("2026-06-24T12:00:00.000Z"),
        ],
      },
      vehicles: [],
      totalPricing: {
        total: 0,
        totalWithCompanyTariffAndCommission: 0,
        modifiers: { commission: 0, companyTariff: 0 },
      },
    };

    const superDispatchOrder = {
      guid: "sd-guid",
      status: "accepted",
      created_at: "2026-06-01T10:00:00.000Z",
      changed_at: "2026-06-10T15:30:00.000Z",
      transport_type: "open",
      pickup: {
        scheduled_at: "2026-06-18",
        venue: {},
      },
      delivery: {
        scheduled_at: "2026-07-01",
        scheduled_ends_at: "2026-07-01",
        date_type: "exact",
        venue: {},
      },
      vehicles: [],
    };

    const result = await updateOrderScheduleAndVehiclesFromSD(
      superDispatchOrder as any,
      databaseOrder as any,
    );

    // transitTime [1, 3] → spread 2 days → July 1–July 3
    expect(nyIsoDate(result!.schedule!.deliveryEstimated![0] as Date)).toBe(
      "2026-07-01",
    );
    expect(nyIsoDate(result!.schedule!.deliveryEstimated![1] as Date)).toBe(
      "2026-07-03",
    );
  });
});
