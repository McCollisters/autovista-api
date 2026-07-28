import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { getOrderStatusPrefill } from "@/order/controllers/getOrderStatusPrefill";
import { createOrderStatusPrefillToken } from "@/_global/utils/orderStatusPrefillToken";

jest.mock("@/core/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("getOrderStatusPrefill", () => {
  const originalSecret = process.env.JWT_SECRET;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-jwt-secret-for-prefill-tokens";
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = { query: {} };
    res = { status: statusMock as Response["status"] };
    next = jest.fn() as NextFunction;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it("returns the email for a valid token", async () => {
    const token = createOrderStatusPrefillToken("customer@example.com");
    req.query = { token };

    await getOrderStatusPrefill(
      req as Request,
      res as Response,
      next,
    );

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ email: "customer@example.com" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 when token is missing", async () => {
    req.query = {};

    await getOrderStatusPrefill(
      req as Request,
      res as Response,
      next,
    );

    expect(next).toHaveBeenCalledWith({
      statusCode: 400,
      message: "Token is required.",
    });
  });

  it("returns 400 when token is invalid", async () => {
    req.query = { token: "not-a-valid-token" };

    await getOrderStatusPrefill(
      req as Request,
      res as Response,
      next,
    );

    expect(next).toHaveBeenCalledWith({
      statusCode: 400,
      message: "Invalid or expired token.",
    });
  });
});
