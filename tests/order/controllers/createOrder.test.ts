import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Request, Response } from "express";
import { createOrder } from "@/order/controllers/createOrder";
import {
  createMockVehicle,
  createMockQuote,
} from "@tests/utils/testDataFactory";
import { mockRequest, mockResponse, mockNext } from "@tests/utils/mockHelpers";
import { Status, ServiceLevelOption, PaymentType } from "@/_global/enums";

// Mock the services
jest.mock("../../../src/order/services/updateVehiclesWithQuote");
jest.mock("../../../src/order/services/sendOrderToSD");
jest.mock("../../../src/order/services/formatOrderTotalPricing");

// Mock the models
jest.mock("@/_global/models", () => ({
  Order: jest.fn().mockImplementation(() => ({
    // @ts-ignore
    save: jest.fn().mockResolvedValue({}),
  })),
  Quote: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

// Add static methods to Order mock
const { Order } = require("@/_global/models");
Order.findOne = jest.fn();
Order.findByIdAndUpdate = jest.fn();

describe("createOrder Controller", () => {
  let req: Request;
  let res: Response;
  let next: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    req = mockRequest({
      body: {
        quoteId: "test-quote-id",
        transportType: "open",
        serviceLevel: ServiceLevelOption.OneDay,
        origin: {
          locationType: "residential",
          contact: {
            name: "John Doe",
            email: "john@example.com",
            phone: "555-1234",
          },
          address: {
            address: "123 Main St",
            city: "New York",
            state: "NY",
            zip: "10001",
            longitude: "-74.0060",
            latitude: "40.7128",
          },
        },
        destination: {
          locationType: "residential",
          contact: {
            name: "Jane Smith",
            email: "jane@example.com",
            phone: "555-5678",
          },
          address: {
            address: "456 Oak Ave",
            city: "Los Angeles",
            state: "CA",
            zip: "90210",
            longitude: "-118.2437",
            latitude: "34.0522",
          },
        },
        vehicles: [createMockVehicle()],
        customer: {
          name: "Test Customer",
          email: "customer@example.com",
          phone: "555-9999",
        },
        schedule: {
          serviceLevel: ServiceLevelOption.OneDay,
          pickupSelected: new Date("2024-01-15T10:00:00Z"),
          deliveryEstimated: [
            new Date("2024-01-16T10:00:00Z"),
            new Date("2024-01-17T10:00:00Z"),
          ],
        },
        reg: "ABC123",
        paymentType: PaymentType.Billing,
      },
    });

    res = mockResponse();
    next = mockNext();
  });

  describe("Successful Order Creation", () => {
    it("should create an order successfully with billing payment", async () => {
      const mockQuote = createMockQuote({
        _id: "test-quote-id",
        refId: 12345,
        status: "draft",
        portalId: "test-portal-id",
        userId: "test-user-id",
        miles: 1000,
        vehicles: [createMockVehicle()],
      });

      const mockOrder = {
        _id: "test-order-id",
        refId: 12345,
        status: Status.Active,
        portalId: "test-portal-id",
        userId: "test-user-id",
        quoteId: "test-quote-id",
        transportType: "open",
        miles: 1000,
        vehicles: [],
        totalPricing: {},
        schedule: {},
        paymentType: "billing",
        tms: {
          guid: "test-guid",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const mockPricingData = {
        base: 1000,
        modifiers: {},
        totals: {
          whiteGlove: 2000,
          one: {
            open: {
              total: 2000,
              companyTariff: 150,
              commission: 50,
              totalWithCompanyTariffAndCommission: 2200,
            },
            enclosed: {
              total: 2600,
              companyTariff: 195,
              commission: 50,
              totalWithCompanyTariffAndCommission: 2845,
            },
          },
          three: {
            total: 1800,
            companyTariff: 120,
            commission: 50,
            totalWithCompanyTariffAndCommission: 1970,
          },
          five: {
            total: 1600,
            companyTariff: 90,
            commission: 50,
            totalWithCompanyTariffAndCommission: 1740,
          },
          seven: {
            total: 1400,
            companyTariff: 60,
            commission: 50,
            totalWithCompanyTariffAndCommission: 1510,
          },
        },
      };

      // Mock the services
      const {
        updateVehiclesWithQuote,
      } = require("../../../src/order/services/updateVehiclesWithQuote");
      const {
        formatOrderTotalPricing,
      } = require("../../../src/order/services/formatOrderTotalPricing");
      const {
        sendOrderToSD,
      } = require("../../../src/order/services/sendOrderToSD");

      updateVehiclesWithQuote.mockResolvedValue([
        {
          ...createMockVehicle(),
          pricing: mockPricingData,
        },
      ]);
      formatOrderTotalPricing.mockResolvedValue(mockPricingData);

      // Mock the models
      const { Quote } = require("@/_global/models");
      const { Order } = require("@/_global/models");

      Quote.findById.mockResolvedValue(mockQuote);
      // @ts-ignore
      Order.findOne = jest.fn().mockResolvedValue(null);
      Order.findByIdAndUpdate = jest.fn();

      // Mock Order constructor and save
      const mockOrderInstance = {
        // @ts-ignore
        save: jest.fn().mockResolvedValue(mockOrder),
      };
      Order.mockImplementation(() => mockOrderInstance);

      const superDispatchResponse = {
        status: "success",
        data: {
          object: {
            guid: "test-guid",
            status: "active",
            created_at: new Date(),
            changed_at: new Date(),
          },
        },
      };
      sendOrderToSD.mockResolvedValue(superDispatchResponse);

      Order.findByIdAndUpdate.mockResolvedValue({
        ...mockOrder,
        tms: {
          guid: "test-guid",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      Quote.findByIdAndUpdate.mockResolvedValue(mockQuote);

      await createOrder(req, res, next);

      expect(updateVehiclesWithQuote).toHaveBeenCalled();
      expect(formatOrderTotalPricing).toHaveBeenCalled();
      expect(sendOrderToSD).toHaveBeenCalled();
      expect(Order).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: "test-order-id",
        }),
      );
    });

    it("should create an order successfully with non-billing payment", async () => {
      const mockQuote = createMockQuote();
      const mockOrder = {
        _id: "test-order-id",
        refId: 12345,
        status: Status.Active,
        portalId: "test-portal-id",
        userId: "test-user-id",
        quoteId: "test-quote-id",
        transportType: "open",
        miles: 1000,
        vehicles: [],
        totalPricing: {},
        schedule: {},
        paymentType: "cod",
      };

      // Update request to use non-billing payment
      req.body.paymentType = "cod";

      // Mock the services
      const {
        updateVehiclesWithQuote,
      } = require("../../../src/order/services/updateVehiclesWithQuote");
      const {
        formatOrderTotalPricing,
      } = require("../../../src/order/services/formatOrderTotalPricing");

      updateVehiclesWithQuote.mockResolvedValue([]);
      formatOrderTotalPricing.mockResolvedValue({});

      // Mock the models
      const { Quote } = require("@/_global/models");
      const { Order } = require("@/_global/models");

      Quote.findById.mockResolvedValue(mockQuote);
      // @ts-ignore
      Order.findOne = jest.fn().mockResolvedValue(null);
      Order.findByIdAndUpdate = jest.fn();

      // Mock Order constructor and save
      const mockOrderInstance = {
        // @ts-ignore
        save: jest.fn().mockResolvedValue(mockOrder),
      };
      Order.mockImplementation(() => mockOrderInstance);

      Quote.findByIdAndUpdate.mockResolvedValue(mockQuote);

      await createOrder(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockOrder);
    });

    it("should create an order with enclosed transport", async () => {
      const mockQuote = createMockQuote();
      const mockOrder = {
        _id: "test-order-id",
        refId: 12345,
        status: Status.Active,
        portalId: "test-portal-id",
        userId: "test-user-id",
        quoteId: "test-quote-id",
        transportType: "enclosed",
        miles: 1000,
        vehicles: [],
        totalPricing: {},
        schedule: {},
        paymentType: "billing",
      };

      // Update request to use enclosed transport
      req.body.transportType = "enclosed";

      // Mock the services
      const {
        updateVehiclesWithQuote,
      } = require("../../../src/order/services/updateVehiclesWithQuote");
      const {
        formatOrderTotalPricing,
      } = require("../../../src/order/services/formatOrderTotalPricing");

      updateVehiclesWithQuote.mockResolvedValue([]);
      formatOrderTotalPricing.mockResolvedValue({});

      // Mock the models
      const { Quote } = require("@/_global/models");
      const { Order } = require("@/_global/models");

      Quote.findById.mockResolvedValue(mockQuote);
      // @ts-ignore
      Order.findOne = jest.fn().mockResolvedValue(null);
      Order.findByIdAndUpdate = jest.fn();

      // Mock Order constructor and save
      const mockOrderInstance = {
        // @ts-ignore
        save: jest.fn().mockResolvedValue(mockOrder),
      };
      Order.mockImplementation(() => mockOrderInstance);

      Quote.findByIdAndUpdate.mockResolvedValue(mockQuote);

      await createOrder(req, res, next);

      expect(updateVehiclesWithQuote).toHaveBeenCalled();
      expect(formatOrderTotalPricing).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("Error Handling", () => {
    it("should return 404 when quote is not found", async () => {
      const { Quote } = require("@/_global/models");

      Quote.findById.mockResolvedValue(null);

      await createOrder(req, res, next);

      expect(next).toHaveBeenCalledWith({
        statusCode: 404,
        message: "Quote not found.",
      });
    });

    it("should return 409 when order already exists", async () => {
      const mockQuote = createMockQuote();
      const mockOrder = { _id: "existing-order-id" };

      const { Quote } = require("@/_global/models");
      const { Order } = require("@/_global/models");

      Quote.findById.mockResolvedValue(mockQuote);
      // @ts-ignore
      Order.findOne = jest.fn().mockResolvedValue(mockOrder);
      Order.findByIdAndUpdate = jest.fn();

      await createOrder(req, res, next);

      expect(next).toHaveBeenCalledWith({
        statusCode: 409,
        message: "Order already exists.",
      });
    });

    it("should handle Super Dispatch failure gracefully", async () => {
      const mockQuote = createMockQuote();
      const mockOrder = { _id: "test-order-id" };

      const {
        updateVehiclesWithQuote,
      } = require("../../../src/order/services/updateVehiclesWithQuote");
      const {
        formatOrderTotalPricing,
      } = require("../../../src/order/services/formatOrderTotalPricing");
      const {
        sendOrderToSD,
      } = require("../../../src/order/services/sendOrderToSD");

      updateVehiclesWithQuote.mockResolvedValue([]);
      formatOrderTotalPricing.mockResolvedValue({});

      const { Quote } = require("@/_global/models");
      const { Order } = require("@/_global/models");

      Quote.findById.mockResolvedValue(mockQuote);
      // @ts-ignore
      Order.findOne = jest.fn().mockResolvedValue(null);
      Order.findByIdAndUpdate = jest.fn();

      // Mock Order constructor and save
      const mockOrderInstance = {
        // @ts-ignore
        save: jest.fn().mockResolvedValue(mockOrder),
      };
      Order.mockImplementation(() => mockOrderInstance);

      const superDispatchResponse = {
        status: "error",
        message: "Super Dispatch API error",
      };
      sendOrderToSD.mockResolvedValue(superDispatchResponse);

      Quote.findByIdAndUpdate.mockResolvedValue(mockQuote);

      await createOrder(req, res, next);

      expect(sendOrderToSD).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockOrder);
    });

    it("should handle order creation failure", async () => {
      const mockQuote = createMockQuote();

      const {
        updateVehiclesWithQuote,
      } = require("../../../src/order/services/updateVehiclesWithQuote");
      const {
        formatOrderTotalPricing,
      } = require("../../../src/order/services/formatOrderTotalPricing");

      updateVehiclesWithQuote.mockResolvedValue([]);
      formatOrderTotalPricing.mockResolvedValue({});

      const { Quote } = require("@/_global/models");
      const { Order } = require("@/_global/models");

      Quote.findById.mockResolvedValue(mockQuote);
      // @ts-ignore
      Order.findOne = jest.fn().mockResolvedValue(null);
      Order.findByIdAndUpdate = jest.fn();

      // Mock Order constructor and save
      const mockOrderInstance = {
        // @ts-ignore
        save: jest.fn().mockResolvedValue(null),
      };
      Order.mockImplementation(() => mockOrderInstance);

      await createOrder(req, res, next);

      expect(next).toHaveBeenCalledWith({
        statusCode: 500,
        message: "Error creating order.",
      });
    });

    it("should handle service errors", async () => {
      const mockQuote = createMockQuote();

      const {
        updateVehiclesWithQuote,
      } = require("../../../src/order/services/updateVehiclesWithQuote");

      const { Quote } = require("@/_global/models");
      const { Order } = require("@/_global/models");

      Quote.findById.mockResolvedValue(mockQuote);
      // @ts-ignore
      Order.findOne = jest.fn().mockResolvedValue(null);
      Order.findByIdAndUpdate = jest.fn();

      updateVehiclesWithQuote.mockRejectedValue(new Error("Service error"));

      await createOrder(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("Data Validation", () => {
    it("should handle missing required fields", async () => {
      const mockQuote = createMockQuote();

      // Create request with missing fields
      req.body = {
        quoteId: "test-quote-id",
        // Missing other required fields
      };

      const { Quote } = require("@/_global/models");
      const { Order } = require("@/_global/models");

      Quote.findById.mockResolvedValue(mockQuote);
      // @ts-ignore
      Order.findOne = jest.fn().mockResolvedValue(null);
      Order.findByIdAndUpdate = jest.fn();

      await createOrder(req, res, next);

      expect(Quote.findById).toHaveBeenCalledWith("test-quote-id");
    });

    it("should handle different service levels", async () => {
      const mockQuote = createMockQuote();
      const mockOrder = { _id: "test-order-id" };

      const {
        updateVehiclesWithQuote,
      } = require("../../../src/order/services/updateVehiclesWithQuote");
      const {
        formatOrderTotalPricing,
      } = require("../../../src/order/services/formatOrderTotalPricing");

      const { Quote } = require("@/_global/models");
      const { Order } = require("@/_global/models");

      // Test different service levels
      const serviceLevels = [
        ServiceLevelOption.WhiteGlove,
        ServiceLevelOption.ThreeDay,
        ServiceLevelOption.FiveDay,
        ServiceLevelOption.SevenDay,
      ];

      for (const serviceLevel of serviceLevels) {
        jest.clearAllMocks();

        req.body.schedule.serviceLevel = serviceLevel;

        Quote.findById.mockResolvedValue(mockQuote);
        Order.findOne.mockResolvedValue(null);

        updateVehiclesWithQuote.mockResolvedValue([]);
        formatOrderTotalPricing.mockResolvedValue({});

        // Mock Order constructor and save
        const mockOrderInstance = {
          // @ts-ignore
          save: jest.fn().mockResolvedValue(mockOrder),
        };
        Order.mockImplementation(() => mockOrderInstance);

        Quote.findByIdAndUpdate.mockResolvedValue(mockQuote);

        await createOrder(req, res, next);

        expect(updateVehiclesWithQuote).toHaveBeenCalled();
        expect(formatOrderTotalPricing).toHaveBeenCalled();
      }
    });
  });
});
