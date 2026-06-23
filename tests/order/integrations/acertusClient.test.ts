import { describe, expect, it, jest } from "@jest/globals";
import { buildCarrierPayload } from "@/order/integrations/acertusClient";

jest.mock("@/core/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("buildCarrierPayload", () => {
  it("includes driver details from order.driver when present", () => {
    const payload = buildCarrierPayload({
      driver: {
        name: "XYZ TRUCKING",
        captivatedId: "12345",
      },
      tms: {
        carrier: {
          name: "Carrier Co",
          identifier: "carrier-1",
          scac: "CARR",
        },
      },
    });

    expect(payload).toMatchObject({
      name: "Carrier Co",
      identifier: "carrier-1",
      scac: "CARR",
      driver: {
        name: "XYZ TRUCKING",
        identifier: "12345",
      },
    });
  });

  it("prefers carrier driver details over order driver details", () => {
    const payload = buildCarrierPayload({
      driver: {
        name: "Order Driver",
        captivatedId: "order-driver-id",
      },
      tms: {
        carrier: {
          driver: {
            name: "Carrier Driver",
            identifier: "carrier-driver-id",
          },
        },
      },
    });

    expect(payload.driver).toMatchObject({
      name: "Carrier Driver",
      identifier: "carrier-driver-id",
    });
  });

  it("omits driver when there are no driver details", () => {
    const payload = buildCarrierPayload({
      tms: {
        carrier: {
          name: "Carrier Co",
        },
      },
    });

    expect(payload.driver).toBeNull();
  });
});
