import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Request, Response } from "express";
import { getQuote } from "@/quote/controllers/getQuote";
import { mockRequest, mockResponse, mockNext } from "@tests/utils/mockHelpers";
import { Quote } from "@/_global/models";
import { createMockQuote } from "@tests/utils/fixtures";

// Mock the Quote model
jest.mock("@/_global/models", () => ({
  Quote: {
    findById: jest.fn(),
  },
}));

describe("getQuote Controller", () => {
  let req: Request;
  let res: Response;
  let next: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    req = mockRequest({
      params: {
        quoteId: "507f1f77bcf86cd799439011",
      },
    });

    res = mockResponse();
    next = mockNext();
  });

  describe("Successful Quote Retrieval", () => {
    it("should return a quote when found", async () => {
      const mockQuote = createMockQuote();

      (Quote.findById as jest.MockedFunction<any>).mockResolvedValue(mockQuote);

      await getQuote(req, res, next);

      expect(Quote.findById).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockQuote);
      expect(next).not.toHaveBeenCalled();
    });

    it("should handle quote with all properties", async () => {
      const mockQuote = {
        ...createMockQuote(),
        vehicles: [
          {
            year: "2020",
            make: "Toyota",
            model: "Camry",
            pricing: {
              base: 1000,
              totals: {
                one: { open: { total: 1200 } },
              },
            },
          },
        ],
        totalPricing: {
          base: 1000,
          totals: {
            one: { open: { total: 1200 } },
          },
        },
      };

      (Quote.findById as jest.MockedFunction<any>).mockResolvedValue(mockQuote);

      await getQuote(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockQuote);
      expect(res.json).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error Handling", () => {
    it("should return 404 when quote is not found", async () => {
      (Quote.findById as jest.MockedFunction<any>).mockResolvedValue(null);

      await getQuote(req, res, next);

      expect(Quote.findById).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
      expect(next).toHaveBeenCalledWith({
        statusCode: 404,
        message: "Quote not found.",
      });
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("should handle database errors", async () => {
      const dbError = new Error("Database connection failed");
      (Quote.findById as jest.MockedFunction<any>).mockRejectedValue(dbError);

      await getQuote(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("should handle invalid quote ID format", async () => {
      req.params.quoteId = "invalid-id";

      const dbError = new Error("Cast to ObjectId failed");
      (Quote.findById as jest.MockedFunction<any>).mockRejectedValue(dbError);

      await getQuote(req, res, next);

      expect(Quote.findById).toHaveBeenCalledWith("invalid-id");
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty quote ID", async () => {
      req.params.quoteId = "";

      (Quote.findById as jest.MockedFunction<any>).mockResolvedValue(null);

      await getQuote(req, res, next);

      expect(Quote.findById).toHaveBeenCalledWith("");
      expect(next).toHaveBeenCalledWith({
        statusCode: 404,
        message: "Quote not found.",
      });
    });

    it("should handle undefined quote ID", async () => {
      req.params.quoteId = undefined as any;

      (Quote.findById as jest.MockedFunction<any>).mockResolvedValue(null);

      await getQuote(req, res, next);

      expect(next).toHaveBeenCalledWith({
        statusCode: 404,
        message: "Quote not found.",
      });
    });
  });
});

