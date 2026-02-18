import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Request, Response } from "express";
import { createOrder } from "@/order/controllers/createOrder";
import {
  createMockVehicle,
  createMockQuote,
} from "@tests/utils/testDataFactory";
import { mockRequest, mockResponse, mockNext } from "@tests/utils/mockHelpers";
import {
  Status,
  ServiceLevelOption,
  PaymentType,
  TransportType,
} from "@/_global/enums";
import { MMI_PORTALS } from "@/_global/constants/portalIds";

// Mock the services
jest.mock("../../../src/order/services/updateVehiclesWithQuote");
jest.mock("../../../src/order/services/sendOrderToSD");
jest.mock("../../../src/order/services/formatOrderTotalPricing");
jest.mock("../../../src/order/integrations/sendPartialOrderToSuper");

// Mock notification modules so we can assert which emails are sent
jest.mock("../../../src/order/notifications/sendOrderAgent");
jest.mock("../../../src/order/notifications/sendMMIOrderNotification");
jest.mock("../../../src/order/notifications/sendOrderCustomerPublicNew");
jest.mock("../../../src/order/notifications/sendCODPaymentRequest");
jest.mock("../../../src/order/notifications/sendWhiteGloveNotification");

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
  Portal: {
    findById: jest.fn(),
  },
  User: {
    findById: jest.fn(),
  },
  Settings: {
    findOne: jest.fn(),
  },
}));

// Add static methods to Order mock
const { Order } = require("@/_global/models");
Order.findOne = jest.fn();
Order.findByIdAndUpdate = jest.fn();
Order.find = jest.fn();

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
        pickupStartDate: "2024-01-15",
        portalId: "test-portal-id",
        // Address fields
        pickupAddress: "123 Main St",
        pickupCity: "New York",
        pickupState: "NY",
        pickupZip: "10001",
        deliveryAddress: "456 Oak Ave",
        deliveryCity: "Los Angeles",
        deliveryState: "CA",
        deliveryZip: "90210",
        // Add quotes array to match the vehicleQuotes
        quotes: [
          {
            ...createMockVehicle(),
            calculatedQuotes: JSON.stringify([
              {
                days: 1, // Service level 1 (OneDay)
                total: 1200,
                totalSD: 1100,
                totalPortal: 1200,
              },
            ]),
          },
        ],
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
        transitTime: 5, // Add transit time
        uniqueId: "12345",
        isCustomerPortal: false,
        vehicleQuotes: [
          {
            ...createMockVehicle(),
            calculatedQuotes: JSON.stringify([
              {
                days: 1, // Service level 1 (OneDay)
                total: 1200,
                totalSD: 1100,
                totalPortal: 1200,
              },
            ]),
          },
        ], // Add at least one vehicle quote with calculated pricing
        transportType: "open",
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
      const {
        sendPartialOrderToSuper,
      } = require("../../../src/order/integrations/sendPartialOrderToSuper");

      updateVehiclesWithQuote.mockResolvedValue([
        {
          ...createMockVehicle(),
          pricing: mockPricingData,
        },
      ]);
      formatOrderTotalPricing.mockResolvedValue(mockPricingData);
      sendPartialOrderToSuper.mockResolvedValue({ success: true });

      // Mock the models
      const { Quote, Portal, Settings } = require("@/_global/models");
      const { Order } = require("@/_global/models");

      const mockPortal = {
        _id: "test-portal-id",
        companyName: "Test Company",
        logo: "https://example.com/logo.png",
      };

      const mockSettings = {
        holidayDates: ["2024-12-25", "2024-01-01"], // Mock holiday dates
      };

      Portal.findById.mockResolvedValue(mockPortal);
      Settings.findOne.mockResolvedValue(mockSettings);
      
      // Add save method to the mock quote
      // @ts-ignore
      mockQuote.save = jest.fn().mockResolvedValue(mockQuote);
      Quote.findById.mockResolvedValue(mockQuote);
      // @ts-ignore
      Order.findOne = jest.fn().mockResolvedValue(null);
      // @ts-ignore
      Order.find = jest.fn().mockResolvedValue([]); // No existing orders
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
        pickupStartDate: "2024-01-15", // Add required field to reach Quote.findById
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

        // Set up complete request body with required fields
        req.body = {
          ...req.body,
          serviceLevel: serviceLevel,
          pickupStartDate: "2024-01-15",
          quoteId: "test-quote-id",
          portalId: "test-portal-id"
        };

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

  describe("Order creation notifications", () => {
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
          enclosed: { total: 2600, companyTariff: 195, commission: 50, totalWithCompanyTariffAndCommission: 2845 },
        },
        three: { total: 1800, companyTariff: 120, commission: 50, totalWithCompanyTariffAndCommission: 1970 },
        five: { total: 1600, companyTariff: 90, commission: 50, totalWithCompanyTariffAndCommission: 1740 },
        seven: { total: 1400, companyTariff: 60, commission: 50, totalWithCompanyTariffAndCommission: 1510 },
      },
    };

    async function setupSuccessfulOrderCreation(overrides: {
      portalId?: string;
      mockOrder?: Record<string, unknown>;
      transportType?: string;
      paymentType?: string;
      customerEmail?: string;
      isCustomerPortal?: boolean;
    } = {}) {
      const portalId = overrides.portalId ?? "test-portal-id";
      const mockOrder = {
        _id: "test-order-id",
        refId: 301182,
        status: Status.Active,
        portalId,
        userId: "test-user-id",
        quoteId: "test-quote-id",
        transportType: overrides.transportType ?? "open",
        miles: 1000,
        vehicles: [],
        totalPricing: {},
        schedule: {},
        paymentType: overrides.paymentType ?? PaymentType.Billing,
        customer: overrides.customerEmail
          ? { name: "Test Customer", email: overrides.customerEmail, phone: "555-9999" }
          : undefined,
        tms: { guid: "test-guid", status: "active", createdAt: new Date(), updatedAt: new Date() },
        ...overrides.mockOrder,
      };

      req.body.portalId = portalId;
      req.body.paymentType = overrides.paymentType ?? req.body.paymentType;
      req.body.transportType = overrides.transportType ?? req.body.transportType;

      const mockQuote = createMockQuote({
        _id: "test-quote-id",
        portalId,
        refId: 301182,
        isCustomerPortal: overrides.isCustomerPortal ?? false,
        vehicleQuotes: [{ ...createMockVehicle(), calculatedQuotes: JSON.stringify([{ days: 1, total: 1200, totalSD: 1100, totalPortal: 1200 }]) }],
        transportType: "open",
      });

      const {
        updateVehiclesWithQuote,
      } = require("../../../src/order/services/updateVehiclesWithQuote");
      const { formatOrderTotalPricing } = require("../../../src/order/services/formatOrderTotalPricing");
      const { sendOrderToSD } = require("../../../src/order/services/sendOrderToSD");
      const { sendPartialOrderToSuper } = require("../../../src/order/integrations/sendPartialOrderToSuper");
      const { Quote, Portal, Settings } = require("@/_global/models");
      const { Order } = require("@/_global/models");
      const sendOrderAgentEmail = require("../../../src/order/notifications/sendOrderAgent").sendOrderAgentEmail;
      const sendMMIOrderNotification = require("../../../src/order/notifications/sendMMIOrderNotification").sendMMIOrderNotification;
      const sendOrderCustomerPublicNew = require("../../../src/order/notifications/sendOrderCustomerPublicNew").sendOrderCustomerPublicNew;
      const sendCODPaymentRequest = require("../../../src/order/notifications/sendCODPaymentRequest").sendCODPaymentRequest;
      const sendWhiteGloveNotification = require("../../../src/order/notifications/sendWhiteGloveNotification").sendWhiteGloveNotification;

      updateVehiclesWithQuote.mockResolvedValue([{ ...createMockVehicle(), pricing: mockPricingData }]);
      formatOrderTotalPricing.mockResolvedValue(mockPricingData);
      sendPartialOrderToSuper.mockResolvedValue({ success: true });
      sendOrderToSD.mockResolvedValue({ status: "success", data: { object: { guid: "test-guid", status: "active", created_at: new Date(), changed_at: new Date() } } });

      const mockPortal = { _id: portalId, companyName: "Test Company", logo: "https://example.com/logo.png" };
      Portal.findById.mockResolvedValue(mockPortal);
      Settings.findOne.mockResolvedValue({ holidayDates: [] });
      // @ts-ignore
      mockQuote.save = jest.fn().mockResolvedValue(mockQuote);
      Quote.findById.mockResolvedValue(mockQuote);
      Quote.findByIdAndUpdate.mockResolvedValue(mockQuote);
      // @ts-ignore - mock return types
      Order.findOne = jest.fn().mockResolvedValue(null);
      // @ts-ignore - mock return types
      Order.find = jest.fn().mockResolvedValue([]);
      Order.findByIdAndUpdate.mockResolvedValue({ ...mockOrder, tms: mockOrder.tms });

      const mockOrderInstance = {
        save: jest.fn().mockResolvedValue(mockOrder),
      };
      Order.mockImplementation(() => mockOrderInstance as any);

      sendOrderAgentEmail.mockResolvedValue({ success: true });
      sendMMIOrderNotification.mockResolvedValue({ success: true });
      sendOrderCustomerPublicNew.mockResolvedValue({ success: true });
      sendCODPaymentRequest.mockResolvedValue({ success: true });
      sendWhiteGloveNotification.mockResolvedValue(undefined);

      await createOrder(req, res, next);

      return {
        sendOrderAgentEmail,
        sendMMIOrderNotification,
        sendOrderCustomerPublicNew,
        sendCODPaymentRequest,
        sendWhiteGloveNotification,
      };
    }

    it("sends Agents Order Confirmation with Pricing to autodesk@graebel.com when portal is MMI and does not send agent order confirmation", async () => {
      const mocks = await setupSuccessfulOrderCreation({
        portalId: MMI_PORTALS[0],
        customerEmail: "customer@example.com",
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mocks.sendMMIOrderNotification).toHaveBeenCalledTimes(1);
      expect(mocks.sendMMIOrderNotification).toHaveBeenCalledWith({
        order: expect.objectContaining({ _id: "test-order-id", refId: 301182 }),
        recipientEmail: "autodesk@graebel.com",
      });
      expect(mocks.sendOrderAgentEmail).not.toHaveBeenCalled();
    });

    it("sends agent order confirmation when portal is not MMI and does not send Agents Order Confirmation with Pricing", async () => {
      const mocks = await setupSuccessfulOrderCreation({
        portalId: "test-portal-id",
        customerEmail: "customer@example.com",
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mocks.sendOrderAgentEmail).toHaveBeenCalledTimes(1);
      expect(mocks.sendOrderAgentEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "test-order-id",
        })
      );
      expect(mocks.sendMMIOrderNotification).not.toHaveBeenCalled();
    });

    it("sends customer order confirmation when order has customer email", async () => {
      const mocks = await setupSuccessfulOrderCreation({
        portalId: "test-portal-id",
        customerEmail: "customer@example.com",
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mocks.sendOrderCustomerPublicNew).toHaveBeenCalledTimes(1);
      expect(mocks.sendOrderCustomerPublicNew).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: "test-order-id",
          customer: expect.objectContaining({ email: "customer@example.com" }),
        })
      );
    });

    it("sends COD payment request when paymentType is COD and order has customer email", async () => {
      const mocks = await setupSuccessfulOrderCreation({
        portalId: "test-portal-id",
        paymentType: PaymentType.Cod,
        customerEmail: "customer@example.com",
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mocks.sendCODPaymentRequest).toHaveBeenCalledTimes(1);
      expect(mocks.sendCODPaymentRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: "test-order-id",
          paymentType: PaymentType.Cod,
          customer: expect.objectContaining({ email: "customer@example.com" }),
        })
      );
    });

    it("sends white glove notification when transportType is WhiteGlove", async () => {
      const mocks = await setupSuccessfulOrderCreation({
        portalId: "test-portal-id",
        transportType: TransportType.WhiteGlove,
        mockOrder: { transportType: TransportType.WhiteGlove },
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mocks.sendWhiteGloveNotification).toHaveBeenCalledTimes(1);
      expect(mocks.sendWhiteGloveNotification).toHaveBeenCalledWith({
        order: expect.objectContaining({ _id: "test-order-id", transportType: TransportType.WhiteGlove }),
      });
    });
  });
});
