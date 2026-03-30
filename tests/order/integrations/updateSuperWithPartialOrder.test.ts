import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { IOrder } from "@/_global/models";

jest.mock("@/_global/integrations/authenticateSuperDispatch", () => ({
  authenticateSuperDispatch: jest.fn().mockResolvedValue("fake-token"),
}));

import { updateSuperWithPartialOrder } from "@/order/integrations/updateSuperWithPartialOrder";

describe("updateSuperWithPartialOrder", () => {
  const baseOrder: Partial<IOrder> = {
    refId: "12345",
    tms: {
      guid: "sd-order-guid-abc",
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    origin: { notes: "Pickup: ring bell" },
    destination: { notes: "Delivery: call ahead" },
  };

  const existingSdOrder = {
    number: "12345",
    purchase_order_number: "99",
    customer: { name: "C" },
    pickup: {
      first_available_pickup_date: "2025-01-01T12:00:00.000Z+0000",
      scheduled_at: "2025-01-01T12:00:00.000Z+0000",
      scheduled_ends_at: "2025-01-02T12:00:00.000Z+0000",
      venue: { city: "A", state: "MI", zip: "12345" },
    },
    delivery: {
      scheduled_at: "2025-01-03T12:00:00.000Z+0000",
      scheduled_ends_at: "2025-01-04T12:00:00.000Z+0000",
      venue: { city: "B", state: "OH", zip: "54321" },
    },
    transport_type: "OPEN",
    vehicles: [
      {
        vin: "VIN123",
        tariff: 100,
        make: "x",
        model: "y",
        is_inoperable: false,
        type: "sedan",
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("PATCH body omits pickup.notes and delivery.notes so partial sync does not push notes to SD", async () => {
    const fetchMock = jest.fn(
      async (url: string | URL, init?: RequestInit): Promise<Response> => {
        const u = String(url);
        const method = init?.method || "GET";
        if (method === "GET" && u.includes("orders/sd-order-guid-abc")) {
          return {
            ok: true,
            json: async () => ({ data: { object: existingSdOrder } }),
          } as Response;
        }
        if (method === "PATCH" && u.includes("orders/sd-order-guid-abc")) {
          const body = JSON.parse(String(init?.body || "{}"));
          expect(body.pickup).toBeDefined();
          expect(body.pickup.notes).toBeUndefined();
          expect(body.delivery).toBeDefined();
          expect(body.delivery.notes).toBeUndefined();
          return {
            ok: true,
            json: async () => ({ data: { object: { ...existingSdOrder } } }),
          } as Response;
        }
        throw new Error(`Unexpected fetch: ${u} ${method}`);
      },
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await updateSuperWithPartialOrder(baseOrder as IOrder);

    const patchCalls = fetchMock.mock.calls.filter(
      (c) => c[1]?.method === "PATCH",
    );
    expect(patchCalls.length).toBe(1);
    const patchBody = JSON.parse(String(patchCalls[0][1]?.body || "{}"));
    expect(patchBody.pickup.notes).toBeUndefined();
    expect(patchBody.delivery.notes).toBeUndefined();
  });
});
