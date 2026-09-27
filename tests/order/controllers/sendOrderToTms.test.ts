import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { sendOrderToTms } from "@/order/controllers/sendOrderToTms";
import { Role } from "@/user/schema";

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

const mockFindById = jest.fn() as jest.MockedFunction<
  (...args: any[]) => Promise<any>
>;
jest.mock("@/_global/models", () => ({
  Order: {
    findById: (...args: unknown[]) => mockFindById(...args),
    findByIdAndUpdate: jest.fn(),
  },
  Portal: {
    findById: jest.fn(),
  },
}));

jest.mock("@/order/integrations/sendOrderToSuper", () => ({
  sendOrderToSuper: jest.fn(),
}));
jest.mock("@/order/integrations/sendPartialOrderToSuper", () => ({
  sendPartialOrderToSuper: jest.fn(),
}));
jest.mock("@/order/integrations/updateSuperWithCompleteOrder", () => ({
  updateSuperWithCompleteOrder: jest.fn(),
}));
jest.mock("@/order/integrations/updateSuperWithPartialOrder", () => ({
  updateSuperWithPartialOrder: jest.fn(),
}));

describe("sendOrderToTms", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    mockGetUserFromToken.mockReset();
    mockFindById.mockReset();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = {
      headers: { authorization: "Bearer token" },
      params: { orderId: "order-1" },
    };
    res = { status: statusMock as Response["status"] };
    next = jest.fn() as NextFunction;
  });

  it("rejects a signed-in request when req.user was never set and the token is missing", async () => {
    req.headers = {};
    mockGetUserFromToken.mockResolvedValue(null);

    await sendOrderToTms(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith({
      statusCode: 401,
      message: "Unauthorized",
    });
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("loads the platform admin from the bearer token when req.user is unset", async () => {
    mockGetUserFromToken.mockResolvedValue({ role: Role.PlatformAdmin });
    mockFindById.mockResolvedValue(null);

    await sendOrderToTms(req as Request, res as Response, next);

    expect(mockGetUserFromToken).toHaveBeenCalledWith("Bearer token");
    expect(next).toHaveBeenCalledWith({
      statusCode: 404,
      message: "Order not found.",
    });
  });

  it("rejects a non-admin even when the token is valid", async () => {
    mockGetUserFromToken.mockResolvedValue({ role: Role.PortalAdmin });

    await sendOrderToTms(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith({
      statusCode: 403,
      message: "Unauthorized. platform_admin access required.",
    });
    expect(mockFindById).not.toHaveBeenCalled();
  });
});
