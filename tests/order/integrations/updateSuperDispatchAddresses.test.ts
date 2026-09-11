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

import {
  resolveStreetForSuperDispatch,
  updateSuperDispatchAddresses,
} from "@/order/integrations/updateSuperDispatchAddresses";

describe("resolveStreetForSuperDispatch", () => {
  it("keeps the Super Dispatch street while the order is still partial", () => {
    expect(
      resolveStreetForSuperDispatch({
        isPartial: true,
        avStreet: "100 Lake Rd",
        sdStreet: "123 Example St. ADDRESS WITHHELD",
      }),
    ).toBe("123 Example St. ADDRESS WITHHELD");
  });

  it("uses the Autovista street after full release", () => {
    expect(
      resolveStreetForSuperDispatch({
        isPartial: false,
        avStreet: "100 Lake Rd",
        sdStreet: "123 Example St. ADDRESS WITHHELD",
      }),
    ).toBe("100 Lake Rd");
  });

  it("does not fall back to a withheld placeholder after full release", () => {
    expect(
      resolveStreetForSuperDispatch({
        isPartial: false,
        avStreet: "123 Example St. ADDRESS WITHHELD",
        sdStreet: "123 Example St. ADDRESS WITTHELD",
      }),
    ).toBeNull();
  });
});

describe("updateSuperDispatchAddresses", () => {
  const baseOrder = {
    refId: "12345",
    tmsPartialOrder: true,
    tms: {
      guid: "sd-order-guid-abc",
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    origin: {
      contact: { name: "Pickup Contact" },
      address: {
        address: "123 Pickup St",
        city: "Austin",
        state: "TX",
        zip: "78701",
      },
      latitude: "30.2672",
      longitude: "-97.7431",
    },
    destination: {
      contact: { name: "Delivery Contact" },
      address: {
        address: "100 Lake Rd",
        city: "Lake Jackson",
        state: "TX",
        zip: "77566",
      },
      latitude: "29.0339",
      longitude: "-95.4344",
    },
  } as unknown as IOrder;

  const existingSdOrder = {
    pickup: {
      venue: {
        name: "Address Withheld",
        address: "123 Example St. ADDRESS WITHHELD",
        city: "Austin",
        state: "TX",
        zip: "78701",
      },
    },
    delivery: {
      venue: {
        name: "Address Withheld",
        address: "123 Example St. ADDRESS WITHHELD",
        city: "Freeport",
        state: "TX",
        zip: "77541",
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("PATCHes Autovista city/state/zip while keeping withheld streets on partial orders", async () => {
    let patchedBody: Record<string, unknown> | null = null;
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
          patchedBody = JSON.parse(String(init?.body || "{}"));
          return {
            ok: true,
            json: async () => ({ data: { object: existingSdOrder } }),
          } as Response;
        }
        throw new Error(`Unexpected fetch: ${u} ${method}`);
      },
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await updateSuperDispatchAddresses(baseOrder);

    expect(patchedBody).not.toBeNull();
    const pickup = patchedBody?.pickup as {
      venue: { address: string; city: string };
    };
    const delivery = patchedBody?.delivery as {
      venue: { address: string; city: string; zip: string };
    };
    expect(pickup.venue.address).toBe("123 Example St. ADDRESS WITHHELD");
    expect(pickup.venue.city).toBe("Austin");
    expect(delivery.venue.address).toBe("123 Example St. ADDRESS WITHHELD");
    expect(delivery.venue.city).toBe("Lake Jackson");
    expect(delivery.venue.zip).toBe("77566");
  });

  it("PATCHes real Autovista streets after the order is fully released", async () => {
    let patchedBody: Record<string, unknown> | null = null;
    const fetchMock = jest.fn(
      async (url: string | URL, init?: RequestInit): Promise<Response> => {
        const method = init?.method || "GET";
        if (method === "GET") {
          return {
            ok: true,
            json: async () => ({ data: { object: existingSdOrder } }),
          } as Response;
        }
        patchedBody = JSON.parse(String(init?.body || "{}"));
        return {
          ok: true,
          json: async () => ({ data: { object: existingSdOrder } }),
        } as Response;
      },
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await updateSuperDispatchAddresses({
      ...baseOrder,
      tmsPartialOrder: false,
    } as IOrder);

    const delivery = patchedBody?.delivery as { venue: { address: string } };
    expect(delivery.venue.address).toBe("100 Lake Rd");
  });

  it("includes Autovista address line 2 in the Super Dispatch street after full release", async () => {
    let patchedBody: Record<string, unknown> | null = null;
    const fetchMock = jest.fn(
      async (_url: string | URL, init?: RequestInit): Promise<Response> => {
        if ((init?.method || "GET") === "GET") {
          return {
            ok: true,
            json: async () => ({ data: { object: existingSdOrder } }),
          } as Response;
        }
        patchedBody = JSON.parse(String(init?.body || "{}"));
        return {
          ok: true,
          json: async () => ({ data: { object: existingSdOrder } }),
        } as Response;
      },
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await updateSuperDispatchAddresses({
      ...baseOrder,
      tmsPartialOrder: false,
      destination: {
        ...baseOrder.destination,
        address: {
          ...baseOrder.destination?.address,
          addressLine2: "Unit 4",
        },
      },
    } as IOrder);

    const delivery = patchedBody?.delivery as { venue: { address: string } };
    expect(delivery.venue.address).toBe("100 Lake Rd Unit 4");
  });

  it("omits notes and real contact names while the order is still partial", async () => {
    let patchedBody: Record<string, unknown> | null = null;
    const fetchMock = jest.fn(
      async (_url: string | URL, init?: RequestInit): Promise<Response> => {
        if ((init?.method || "GET") === "GET") {
          return {
            ok: true,
            json: async () => ({ data: { object: existingSdOrder } }),
          } as Response;
        }
        patchedBody = JSON.parse(String(init?.body || "{}"));
        return {
          ok: true,
          json: async () => ({ data: { object: existingSdOrder } }),
        } as Response;
      },
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await updateSuperDispatchAddresses({
      ...baseOrder,
      origin: {
        ...baseOrder.origin,
        notes: "Gate code 1234",
        contact: { name: "Jane Doe", companyName: "MMI Warehouse" },
      },
    } as IOrder);

    const pickup = patchedBody?.pickup as {
      notes?: string;
      venue: { name: string; contact_name?: string };
    };
    expect(pickup.notes).toBeUndefined();
    expect(pickup.venue.name).toBe("Address Withheld");
    expect(pickup.venue.contact_name).toBeUndefined();
  });

  it("PATCHes Autovista notes and contact name after full release", async () => {
    let patchedBody: Record<string, unknown> | null = null;
    const fetchMock = jest.fn(
      async (_url: string | URL, init?: RequestInit): Promise<Response> => {
        if ((init?.method || "GET") === "GET") {
          return {
            ok: true,
            json: async () => ({ data: { object: existingSdOrder } }),
          } as Response;
        }
        patchedBody = JSON.parse(String(init?.body || "{}"));
        return {
          ok: true,
          json: async () => ({ data: { object: existingSdOrder } }),
        } as Response;
      },
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await updateSuperDispatchAddresses({
      ...baseOrder,
      tmsPartialOrder: false,
      origin: {
        ...baseOrder.origin,
        notes: "Gate code 1234",
        contact: { name: "Jane Doe", companyName: "MMI Warehouse" },
      },
    } as IOrder);

    const pickup = patchedBody?.pickup as {
      notes?: string;
      venue: { name: string; contact_name?: string };
    };
    expect(pickup.notes).toBe("Gate code 1234");
    expect(pickup.venue.name).toBe("MMI Warehouse");
    expect(pickup.venue.contact_name).toBe("Jane Doe");
  });
});
