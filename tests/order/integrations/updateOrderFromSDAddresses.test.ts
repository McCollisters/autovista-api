import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  shouldUseSuperDispatchAddressValue,
  updateOrderFromSD,
} from "@/order/integrations/updateOrderFromSD";

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

const buildDatabaseOrder = (overrides: Record<string, unknown> = {}) => ({
  refId: "12345",
  portalId: "portal-id",
  userId: "user-id",
  quoteId: "quote-id",
  reg: "PO-1",
  status: "booked",
  tmsPartialOrder: true,
  transportType: "open",
  miles: 100,
  customer: {
    name: "Customer",
    email: "customer@example.com",
  },
  schedule: {
    pickupEstimated: [new Date("2026-06-17T12:00:00.000Z")],
    pickupSelected: new Date("2026-06-17T12:00:00.000Z"),
    deliveryEstimated: [new Date("2026-06-21T12:00:00.000Z")],
  },
  origin: {
    contact: { name: "Pickup Contact", phone: "1112223333" },
    address: {
      address: "123 Example St. ADDRESS WITTHELD",
      city: "Austin",
      state: "TX",
      zip: "78701",
    },
    notes: "Pickup note",
  },
  destination: {
    contact: { name: "Delivery Contact", phone: "4445556666" },
    address: {
      address: "456 Old Ave",
      city: "Dallas",
      state: "TX",
      zip: "75201",
    },
    notes: "Delivery note",
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
  ...overrides,
});

const buildSuperDispatchOrder = (overrides: Record<string, unknown> = {}) => ({
  guid: "sd-guid",
  status: "new",
  created_at: "2026-06-01T10:00:00.000Z",
  changed_at: "2026-06-10T15:30:00.000Z",
  purchase_order_number: "PO-1",
  transport_type: "open",
  pickup: {
    scheduled_at: "2026-06-18",
    scheduled_ends_at: "2026-06-20",
    date_type: "estimated",
    notes: "",
    venue: {
      address: "789 Updated Pickup Rd",
      city: "Houston",
      state: "TX",
      zip: "77002-1234",
    },
  },
  delivery: {
    scheduled_at: "2026-06-21",
    scheduled_ends_at: "2026-07-04",
    date_type: "estimated",
    notes: "",
    venue: {
      address: "123 Example St. ADDRESS WITTHELD",
      city: "San Antonio",
      state: "TX",
      zip: "78205",
    },
  },
  vehicles: [
    {
      make: "Toyota",
      model: "Camry",
      vin: "VIN123",
      year: "2021",
      is_inoperable: false,
      type: "sedan",
      tariff: 550,
    },
  ],
  ...overrides,
});

describe("updateOrderFromSD address sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Portal.findById.mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve({
            _id: "portal-id",
            companyName: "Test Portal",
          }),
      }),
    });
  });

  it("accepts real Super Dispatch address edits even when the local order is partial/withheld", async () => {
    const result = await updateOrderFromSD(
      buildSuperDispatchOrder() as any,
      buildDatabaseOrder() as any,
    );

    expect(result?.origin?.address?.address).toBe("789 Updated Pickup Rd");
    expect(result?.origin?.address?.city).toBe("Houston");
    expect(result?.origin?.address?.state).toBe("TX");
    expect(result?.origin?.address?.zip).toBe("770021234");
  });

  it("does not overwrite street address with a Super Dispatch withheld placeholder", async () => {
    const result = await updateOrderFromSD(
      buildSuperDispatchOrder() as any,
      buildDatabaseOrder() as any,
    );

    expect(result?.destination?.address?.address).toBe("456 Old Ave");
    expect(result?.destination?.address?.city).toBe("San Antonio");
    expect(result?.destination?.address?.zip).toBe("78205");
  });
});

describe("shouldUseSuperDispatchAddressValue", () => {
  it("rejects blank, missing, and withheld values", () => {
    expect(shouldUseSuperDispatchAddressValue(undefined)).toBe(false);
    expect(shouldUseSuperDispatchAddressValue(null)).toBe(false);
    expect(shouldUseSuperDispatchAddressValue("   ")).toBe(false);
    expect(
      shouldUseSuperDispatchAddressValue("123 Example St. ADDRESS WITTHELD"),
    ).toBe(false);
  });

  it("accepts non-withheld values", () => {
    expect(shouldUseSuperDispatchAddressValue("789 Updated Pickup Rd")).toBe(
      true,
    );
  });
});
