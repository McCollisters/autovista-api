import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { findQuoteCustomer } from "@/quote/controllers/findQuoteCustomer";

jest.mock("@/core/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockSelect = jest.fn() as jest.MockedFunction<
  (...args: any[]) => Promise<any>
>;
jest.mock("@/_global/models", () => ({
  Quote: {
    findOne: () => ({
      select: (...args: unknown[]) => mockSelect(...args),
    }),
  },
  Order: {
    findOne: () => ({
      select: () => ({
        lean: () => Promise.resolve(null),
      }),
    }),
  },
}));

const quote = (customer: Record<string, string>) => ({
  customer,
  status: "saved",
  _id: "quote-1",
  toObject() {
    return { _id: "quote-1", status: "saved", customer: this.customer };
  },
});

describe("findQuoteCustomer", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    mockSelect.mockReset();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = { body: {} };
    res = { status: statusMock as Response["status"] };
    next = jest.fn() as NextFunction;
  });

  it("finds a quote from the confirmation code alone", async () => {
    mockSelect.mockResolvedValue(
      quote({ quoteConfirmationCode: "ABC123", name: "Jane Smith" }),
    );
    req.body = { customerCode: "abc123" };

    await findQuoteCustomer(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "quote-1" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts Smith for a customer named Jane Smith Jr", async () => {
    mockSelect.mockResolvedValue(
      quote({ trackingCode: "ABC123", name: "Jane Smith Jr." }),
    );
    req.body = { customerCode: "ABC123", customerLastName: "Smith" };

    await findQuoteCustomer(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("accepts a matching email even when the last name does not match", async () => {
    mockSelect.mockResolvedValue(
      quote({
        quoteConfirmationCode: "ABC123",
        name: "Jane Smith",
        email: "jane@example.com",
      }),
    );
    req.body = {
      customerCode: "ABC123",
      customerEmail: "jane@example.com",
      customerLastName: "Doe",
    };

    await findQuoteCustomer(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("rejects a wrong email even when the last name matches", async () => {
    mockSelect.mockResolvedValue(
      quote({
        quoteConfirmationCode: "ABC123",
        name: "Jane Smith",
        email: "jane@example.com",
      }),
    );
    req.body = {
      customerCode: "ABC123",
      customerEmail: "other@example.com",
      customerLastName: "Smith",
    };

    await findQuoteCustomer(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      error:
        "Sorry, this confirmation code does not match the email we have on file.",
    });
  });

  it("rejects a last name that is not the surname", async () => {
    mockSelect.mockResolvedValue(
      quote({ quoteConfirmationCode: "ABC123", name: "Jonathan Smith" }),
    );
    req.body = { customerCode: "ABC123", customerLastName: "nathan" };

    await findQuoteCustomer(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
