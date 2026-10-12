import { describe, it, expect, beforeEach, jest } from "@jest/globals";

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

import { sendPartialOrderToSuper } from "@/order/integrations/sendPartialOrderToSuper";

describe("sendPartialOrderToSuper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("withholds VIN from the sanitized partial create payload", async () => {
    const fetchMock = jest.fn(
      async (_url: string | URL, init?: RequestInit): Promise<Response> => {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body || "{}"));
        expect(body.vehicles).toHaveLength(1);
        expect(body.vehicles[0].vin).toBeUndefined();
        expect(JSON.stringify(body)).not.toContain("1HGBH41JXMN109186");
        const payload = {
          data: { object: { guid: "sd-guid", ...body } },
        };
        return {
          ok: true,
          text: async () => JSON.stringify(payload),
          json: async () => payload,
        } as Response;
      },
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const pickup = new Date("2026-10-12T12:00:00.000Z");
    const delivery = new Date("2026-10-15T12:00:00.000Z");

    await sendPartialOrderToSuper({
      quotes: [
        {
          vin: "1HGBH41JXMN109186",
          make: "Honda",
          model: "Civic",
          year: "2020",
          pricingClass: "SEDAN",
          isInoperable: false,
          pricing: { total: 500 },
        } as any,
      ],
      orderNumber: "12345",
      portal: { companyName: "Test Portal" } as any,
      dateRanges: [pickup, pickup, delivery, delivery],
      transportType: "OPEN",
      pickupCity: "Detroit",
      pickupState: "MI",
      pickupZip: "48201",
      deliveryCity: "Chicago",
      deliveryState: "IL",
      deliveryZip: "60601",
      serviceLevel: 7,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
