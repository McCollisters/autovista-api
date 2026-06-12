import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { updateOrderScheduleAndVehiclesFromSD } from "@/order/integrations/updateOrderFromSD";

jest.mock("@/_global/models", () => ({
  Portal: {
    findById: jest.fn(),
  },
}));

const { Portal } = require("@/_global/models");

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
});
