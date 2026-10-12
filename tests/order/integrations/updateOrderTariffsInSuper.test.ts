import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { IOrder } from "@/_global/models";

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

import { updateOrderTariffsInSuper } from "@/order/integrations/updateOrderTariffsInSuper";

describe("updateOrderTariffsInSuper", () => {
  const existingSdOrder = {
    vehicles: [
      {
        guid: "sd-vehicle-1",
        vin: "LEAKEDVIN123456789",
        tariff: 100,
        make: "Honda",
        model: "Civic",
        year: 2020,
        is_inoperable: false,
        type: "sedan",
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("clears VIN on tariff PATCH while the order is still partial", async () => {
    const fetchMock = jest.fn(
      async (url: string | URL, init?: RequestInit): Promise<Response> => {
        const u = String(url);
        const method = init?.method || "GET";
        if (method === "GET" && u.includes("orders/sd-order-guid")) {
          return {
            ok: true,
            json: async () => ({ data: { object: existingSdOrder } }),
          } as Response;
        }
        if (method === "PATCH" && u.includes("orders/sd-order-guid")) {
          const body = JSON.parse(String(init?.body || "{}"));
          expect(body.vehicles?.[0]?.vin).toBeNull();
          return {
            ok: true,
            json: async () => ({ data: { object: existingSdOrder } }),
          } as Response;
        }
        throw new Error(`Unexpected fetch: ${u} ${method}`);
      },
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const order = {
      refId: "12345",
      tmsPartialOrder: true,
      tms: { guid: "sd-order-guid" },
      vehicles: [
        {
          vin: "1HGBH41JXMN109186",
          make: "Honda",
          model: "Civic",
          year: "2020",
          pricingClass: "SEDAN",
          isInoperable: false,
          pricing: { total: 550 },
        },
      ],
    } as unknown as IOrder;

    await updateOrderTariffsInSuper(order);

    const patchCalls = fetchMock.mock.calls.filter(
      (c) => c[1]?.method === "PATCH",
    );
    expect(patchCalls.length).toBe(1);
  });

  it("includes VIN on tariff PATCH after details are released", async () => {
    const fetchMock = jest.fn(
      async (url: string | URL, init?: RequestInit): Promise<Response> => {
        const u = String(url);
        const method = init?.method || "GET";
        if (method === "GET" && u.includes("orders/sd-order-guid")) {
          return {
            ok: true,
            json: async () => ({ data: { object: existingSdOrder } }),
          } as Response;
        }
        if (method === "PATCH" && u.includes("orders/sd-order-guid")) {
          const body = JSON.parse(String(init?.body || "{}"));
          expect(body.vehicles?.[0]?.vin).toBe("1HGBH41JXMN109186");
          return {
            ok: true,
            json: async () => ({ data: { object: existingSdOrder } }),
          } as Response;
        }
        throw new Error(`Unexpected fetch: ${u} ${method}`);
      },
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const order = {
      refId: "12345",
      tmsPartialOrder: false,
      tms: { guid: "sd-order-guid" },
      vehicles: [
        {
          vin: "1HGBH41JXMN109186",
          make: "Honda",
          model: "Civic",
          year: "2020",
          pricingClass: "SEDAN",
          isInoperable: false,
          pricing: { total: 550 },
        },
      ],
    } as unknown as IOrder;

    await updateOrderTariffsInSuper(order);

    expect(
      fetchMock.mock.calls.filter((c) => c[1]?.method === "PATCH"),
    ).toHaveLength(1);
  });
});
