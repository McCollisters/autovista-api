import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { demoModeMiddleware } from "@/core/middleware/demoMode";
import { Role } from "@/user/schema";
import {
  respondIfDemo,
  rejectDemoMutation,
  DEMO_MODE_DISABLED_MESSAGE,
} from "@/demo/respondWithDemo";
import {
  getDemoOrdersList,
  getDemoQuotesList,
  DEMO_PORTALS,
  DEMO_USERS,
  DEMO_PORTAL_ID,
} from "@/demo/fixtures";

jest.mock("@/core/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockGetUserFromToken = jest.fn() as jest.MockedFunction<
  (...args: any[]) => Promise<any>
>;
jest.mock("@/_global/utils/getUserFromToken", () => ({
  getUserFromToken: (...args: unknown[]) => mockGetUserFromToken(...args),
}));

describe("demoModeMiddleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    mockGetUserFromToken.mockReset();
    req = { headers: {} };
    res = {};
    next = jest.fn() as NextFunction;
  });

  it("leaves demoMode false when header is absent", async () => {
    await demoModeMiddleware(req as Request, res as Response, next);
    expect((req as any).demoMode).toBe(false);
    expect(next).toHaveBeenCalled();
    expect(mockGetUserFromToken).not.toHaveBeenCalled();
  });

  it("ignores header for non-platform-admin users", async () => {
    req.headers = { "x-demo-mode": "1", authorization: "JWT token" };
    mockGetUserFromToken.mockResolvedValue({
      role: Role.PortalAdmin,
      email: "portal@example.com",
    });

    await demoModeMiddleware(req as Request, res as Response, next);
    expect((req as any).demoMode).toBe(false);
    expect(next).toHaveBeenCalled();
  });

  it("enables demoMode for platform_admin with X-Demo-Mode: 1", async () => {
    req.headers = { "x-demo-mode": "1", authorization: "JWT token" };
    mockGetUserFromToken.mockResolvedValue({
      role: Role.PlatformAdmin,
      email: "admin@example.com",
    });

    await demoModeMiddleware(req as Request, res as Response, next);
    expect((req as any).demoMode).toBe(true);
    expect(next).toHaveBeenCalled();
  });
});

describe("respondWithDemo helpers", () => {
  it("respondIfDemo sends payload only when demoMode is set", () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status } as unknown as Response;

    expect(
      respondIfDemo({ demoMode: false } as any, res, { ok: true }),
    ).toBe(false);
    expect(status).not.toHaveBeenCalled();

    expect(
      respondIfDemo({ demoMode: true } as any, res, { ok: true }),
    ).toBe(true);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ ok: true });
  });

  it("rejectDemoMutation blocks mutations in demo mode", () => {
    const next = jest.fn() as NextFunction;
    expect(rejectDemoMutation({ demoMode: false } as any, next)).toBe(false);
    expect(next).not.toHaveBeenCalled();

    expect(rejectDemoMutation({ demoMode: true } as any, next)).toBe(true);
    expect(next).toHaveBeenCalledWith({
      statusCode: 403,
      message: DEMO_MODE_DISABLED_MESSAGE,
    });
  });
});

describe("demo fixtures shapes", () => {
  it("orders list matches portal API shape", () => {
    const list = getDemoOrdersList();
    expect(list.orders.length).toBeGreaterThan(0);
    expect(list.orderCount).toBe(list.orders.length);
    expect(list.orders[0].portalId.companyName).toBe("Horizon Auto Logistics");
    expect(String(list.orders[0].portalId._id)).toBe(DEMO_PORTAL_ID);
    expect(list.orders.every((o) => typeof o.reg === "string" && o.reg.length > 0)).toBe(
      true,
    );
    expect(new Set(list.orders.map((o) => o.reg)).size).toBe(list.orders.length);
    const pickups = list.orders.map((o) => o.origin.address.city);
    const deliveries = list.orders.map((o) => o.destination.address.city);
    expect(new Set(pickups).size).toBeGreaterThan(1);
    expect(new Set(deliveries).size).toBeGreaterThan(1);
    expect(
      list.orders.every(
        (o) =>
          o.origin.address.address &&
          o.origin.address.city &&
          o.origin.address.state &&
          o.origin.address.zip &&
          o.destination.address.address &&
          o.destination.address.city &&
          o.destination.address.state &&
          o.destination.address.zip,
      ),
    ).toBe(true);
    expect(
      list.orders.every(
        (o) =>
          (o.totalPricing?.totalWithCompanyTariffAndCommission || 0) > 0 &&
          o.vehicles.every(
            (v) =>
              (v.pricing?.totalWithCompanyTariffAndCommission || 0) > 0 &&
              (v.pricing?.base || 0) > 0 &&
              typeof v.vin === "string" &&
              v.vin.length === 17 &&
              typeof v.pricingClass === "string" &&
              v.pricingClass.length > 0,
          ),
      ),
    ).toBe(true);
    expect(new Set(list.orders.flatMap((o) => o.vehicles.map((v) => v.make))).size).toBeGreaterThan(
      1,
    );
    expect(list.orders.some((o) => o.vehicles.length > 1)).toBe(true);
    expect(list.orders.some((o) => o.transportType === "WHITEGLOVE")).toBe(true);
    expect(list.orders.some((o) => o.transportType === "ENCLOSED")).toBe(true);
    expect(list.orders.some((o) => o.paymentType === "COD")).toBe(true);
    expect(
      list.orders.every(
        (o) => typeof o.tms?.createdAt === "string" && o.tms.createdAt.length > 0,
      ),
    ).toBe(true);
  });

  it("quotes list matches portal API shape", () => {
    const list = getDemoQuotesList();
    expect(list.quotes.length).toBeGreaterThan(0);
    expect(list.quoteCount).toBe(list.quotes.length);
    expect(list.quotes[0].portalId.companyName).toBe("Horizon Auto Logistics");
    expect(String(list.quotes[0].portalId._id)).toBe(DEMO_PORTAL_ID);
    const pickups = list.quotes.map((q) => q.origin.validated);
    const deliveries = list.quotes.map((q) => q.destination.validated);
    expect(new Set(pickups).size).toBeGreaterThan(1);
    expect(new Set(deliveries).size).toBeGreaterThan(1);
    const vehicleCounts = list.quotes.map((q) => q.vehicles.length);
    expect(Math.max(...vehicleCounts)).toBeGreaterThan(1);
    const makes = list.quotes.flatMap((q) => q.vehicles.map((v) => v.make));
    expect(new Set(makes).size).toBeGreaterThan(1);
    expect(
      list.quotes.every((q) =>
        q.vehicles.every(
          (v) =>
            typeof v.vin === "string" &&
            v.vin.length === 17 &&
            typeof v.pricingClass === "string",
        ),
      ),
    ).toBe(true);
    const whiteGloveQuotes = list.quotes.filter(
      (q) => q.transportType === "WHITEGLOVE",
    );
    expect(whiteGloveQuotes.length).toBeGreaterThan(0);
    expect(
      whiteGloveQuotes.every((q) => (q.totalPricing.totals.whiteGlove || 0) > 0),
    ).toBe(true);
    expect(list.quotes.some((q) => q.transportType === "ENCLOSED")).toBe(true);
    expect(
      list.quotes.every((q) => {
        const totals = q.totalPricing?.totals;
        const levels = ["one", "three", "five", "seven"] as const;
        return levels.every((level) => {
          const open = totals?.[level]?.open;
          const enclosed = totals?.[level]?.enclosed;
          return (
            open &&
            enclosed &&
            open.total > 0 &&
            open.companyTariff > 0 &&
            open.commission > 0 &&
            open.totalWithCompanyTariffAndCommission > 0 &&
            enclosed.total > 0 &&
            enclosed.companyTariff > 0 &&
            enclosed.commission > 0 &&
            enclosed.totalWithCompanyTariffAndCommission > 0
          );
        });
      }),
    ).toBe(true);
  });

  it("portals and users are scoped to the demo company POV", () => {
    expect(DEMO_PORTALS).toHaveLength(1);
    expect(DEMO_PORTALS[0]._id).toBe(DEMO_PORTAL_ID);
    expect(DEMO_USERS.every((u) => String((u.portalId as any)._id) === DEMO_PORTAL_ID)).toBe(
      true,
    );
  });
});
