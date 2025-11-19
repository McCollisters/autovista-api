import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Request, Response } from "express";
import { getOrders } from "@/order/controllers/getOrders";
import { mockRequest, mockResponse, mockNext } from "@tests/utils/mockHelpers";
import { Order } from "@/_global/models";
import { createMockOrder } from "@tests/utils/testDataFactory";

// Mock the Order model
jest.mock("@/_global/models", () => ({
  Order: {
    find: jest.fn(),
  },
}));

describe("getOrders Controller", () => {
  let req: Request;
  let res: Response;
  let next: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    req = mockRequest();
    res = mockResponse();
    next = mockNext();
  });

  describe("Successful Order Retrieval", () => {
    it("should return all orders when found", async () => {
      const mockOrders = [
        createMockOrder({ refId: 12345, status: "Booked" }),
        createMockOrder({ refId: 12346, status: "Complete" }),
        createMockOrder({ refId: 12347, status: "Pending" }),
      ];

      (Order.find as jest.MockedFunction<any>).mockResolvedValue(mockOrders);

      await getOrders(req, res, next);

      expect(Order.find).toHaveBeenCalledWith({});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockOrders);
      expect(next).not.toHaveBeenCalled();
    });

    it("should return empty array when no orders exist", async () => {
      (Order.find as jest.MockedFunction<any>).mockResolvedValue([]);

      await getOrders(req, res, next);

      expect(Order.find).toHaveBeenCalledWith({});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
      expect(next).not.toHaveBeenCalled();
    });

    it("should return orders with all properties", async () => {
      const mockOrders = [
        createMockOrder({
          refId: 12345,
          vehicles: [
            {
              year: "2020",
              make: "Toyota",
              model: "Camry",
              vin: "1HGBH41JXMN109186",
            },
          ],
          customer: {
            name: "Test Customer",
            email: "test@example.com",
            phone: "555-1234",
          },
        }),
      ];

      (Order.find as jest.MockedFunction<any>).mockResolvedValue(mockOrders);

      await getOrders(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockOrders);
      expect(mockOrders[0]).toHaveProperty("vehicles");
      expect(mockOrders[0]).toHaveProperty("customer");
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors", async () => {
      const dbError = new Error("Database connection failed");
      // Mock Order.find to return a promise that rejects
      (Order.find as jest.MockedFunction<any>).mockReturnValue(
        Promise.reject(dbError) as any,
      );

      await getOrders(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("should handle query errors", async () => {
      const queryError = new Error("Invalid query parameters");
      (Order.find as jest.MockedFunction<any>).mockRejectedValue(queryError);

      await getOrders(req, res, next);

      expect(next).toHaveBeenCalledWith(queryError);
    });
  });

  describe("Edge Cases", () => {
    it("should handle large result sets", async () => {
      const largeOrderSet = Array.from({ length: 100 }, (_, i) =>
        createMockOrder({ refId: 10000 + i }),
      );

      (Order.find as jest.MockedFunction<any>).mockResolvedValue(largeOrderSet);

      await getOrders(req, res, next);

      expect(res.json).toHaveBeenCalledWith(largeOrderSet);
      expect(largeOrderSet).toHaveLength(100);
    });

    it("should handle orders with missing optional fields", async () => {
      const minimalOrders = [
        {
          _id: "507f1f77bcf86cd799439011",
          refId: 12345,
          status: "Booked",
        },
      ];

      (Order.find as jest.MockedFunction<any>).mockResolvedValue(minimalOrders);

      await getOrders(req, res, next);

      expect(res.json).toHaveBeenCalledWith(minimalOrders);
    });
  });
});

