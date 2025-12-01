// @ts-nocheck
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from "@jest/globals";

// Mock nanoid before any imports that use it
jest.mock("nanoid", () => ({
  customAlphabet: jest.fn(() => jest.fn(() => "test123456")),
}));

// Mock getMiles to return a consistent value for testing
jest.mock("@/quote/services/getMiles", () => ({
  getMiles: jest.fn().mockResolvedValue(1000), // Mock 1000 miles for consistent testing
}));

// Mock location utilities
jest.mock("@/_global/utils/location", () => ({
  getCoordinates: jest.fn().mockResolvedValue([-74.006, 40.7128]), // Mock NYC coordinates
}));

// Mock location validation
jest.mock("@/quote/services/validateLocation", () => ({
  validateLocation: jest.fn().mockResolvedValue({
    location: "New York, NY",
    state: "NY",
    error: null,
  }),
}));

// Mock TMS base rate to avoid external API calls
jest.mock("@/quote/integrations/getTMSBaseRate", () => ({
  getTMSBaseRate: jest.fn().mockResolvedValue({ quote: 800 }), // Mock base rate
}));
import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import { config } from "@/config/index";
import {
  createMockVehicle,
  createMockPortal,
  createMockModifierSet,
} from "@tests/utils/testDataFactory";
import {
  getPortalFixture,
  getGlobalModifierSetFixture,
} from "@tests/utils/fixtures";

// Don't import the main app to avoid database conflicts

// Import models
import { Portal, ModifierSet } from "@/_global/models";

// Mock the Portal model to return fixture data
jest.mock("@/_global/models", () => ({
  Portal: {
    findById: jest.fn(),
  },
  ModifierSet: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  },
  Quote: jest.fn().mockImplementation((data) => ({
    ...data,
    _id: "507f1f77bcf86cd799439012",
    refId: "REF123456",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    save: jest.fn().mockResolvedValue({
      ...data,
      _id: "507f1f77bcf86cd799439012",
      refId: "REF123456",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    }),
  })),
}));

describe("createQuote API Integration Tests", () => {
  let testApp: express.Application;
  let testPortal: any;

  beforeAll(async () => {
    // Create a separate test app to avoid database conflicts
    testApp = express();

    // Set up basic middleware for the test app
    testApp.use(express.json());

    // Import and set up routes
    const portalRoutes = await import("@/portal/routes");
    const quoteRoutes = await import("@/quote/routes");
    const userRoutes = await import("@/user/routes");
    const orderRoutes = await import("@/order/routes");
    const healthRoutes = await import("@/presentation/routes/health");

    testApp.use("/", healthRoutes.default);
    testApp.use("/api/v1/portal", portalRoutes.default);
    testApp.use("/api/v1/user", userRoutes.default);
    testApp.use("/api/v1/quote", quoteRoutes.default);
    testApp.use("/api/v1/order", orderRoutes.default);

    // Add error handling middleware
    testApp.use(
      (
        err: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        const statusCode = err.statusCode || 500;
        
        // Only log unexpected server errors (5xx), not expected validation errors (4xx)
        if (statusCode >= 500) {
          console.error("Test app error:", err);
        }
        
        res
          .status(statusCode)
          .json({ error: err.message || "Internal Server Error" });
      },
    );

    // Use portal fixture data directly
    testPortal = getPortalFixture();
    const globalModifierSet = getGlobalModifierSetFixture();

    // Mock Portal.findById to always return our fixture portal
    (Portal.findById as jest.MockedFunction<any>).mockResolvedValue(testPortal);

    // Mock ModifierSet.findOne().lean() chain to return our global modifier set
    (ModifierSet.findOne as jest.MockedFunction<any>).mockImplementation((query: any) => {
      if (query.isGlobal) {
        // Return a mock document with toObject method for global modifiers
        return Promise.resolve({
          ...globalModifierSet,
          toObject: () => globalModifierSet,
        });
      } else {
        // Return lean() chainable for portal modifiers
        return {
          lean: jest.fn().mockResolvedValue(null),
        };
      }
    });
  });

  afterAll(async () => {
    // Clean up mocks
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Re-setup the mocks to return our fixtures
    (Portal.findById as jest.MockedFunction<any>).mockResolvedValue(testPortal);
    (ModifierSet.findOne as jest.MockedFunction<any>).mockImplementation((query: any) => {
      if (query.isGlobal) {
        // Return a mock document with toObject method for global modifiers
        const globalModifierSet = getGlobalModifierSetFixture();
        return Promise.resolve({
          ...globalModifierSet,
          toObject: () => globalModifierSet,
        });
      } else {
        // Return lean() chainable for portal modifiers
        return {
          lean: jest.fn().mockResolvedValue(null),
        };
      }
    });
  });

  describe("POST /api/v1/quote", () => {
    it("should create a quote successfully with valid data", async () => {
      const quoteData = {
        portalId: testPortal._id.toString(),
        userId: "5f9b2a63a6be2500170b0e90",
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        vehicles: [createMockVehicle()],
      };

      const response = await request(testApp)
        .post("/api/v1/quote")
        .send(quoteData)
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty("_id");
      expect(response.body).toHaveProperty("refId");
      expect(response.body).toHaveProperty("vehicles");
      expect(response.body).toHaveProperty("totalPricing");
      expect(response.body).toHaveProperty("portalId");
      expect(response.body).toHaveProperty("createdAt");
      expect(response.body).toHaveProperty("updatedAt");

      // Verify vehicles data
      expect(response.body.vehicles).toHaveLength(1);
      expect(response.body.vehicles[0]).toMatchObject({
        year: "2020",
        make: "Toyota",
        model: "Camry",
        isInoperable: false,
        isOversize: false,
        transportType: "open",
        pricingClass: "sedan",
      });

      // Verify total pricing structure
      expect(response.body.totalPricing).toHaveProperty("base");
      expect(response.body.totalPricing).toHaveProperty("modifiers");
      expect(response.body.totalPricing).toHaveProperty("totals");
      expect(response.body.totalPricing.totals).toHaveProperty("whiteGlove");
      expect(response.body.totalPricing.totals).toHaveProperty("one");
      expect(response.body.totalPricing.totals).toHaveProperty("three");
      expect(response.body.totalPricing.totals).toHaveProperty("five");
      expect(response.body.totalPricing.totals).toHaveProperty("seven");

      // Verify portal ID
      expect(response.body.portalId).toBe(testPortal._id.toString());
    });

    it("should handle multiple vehicles", async () => {
      const quoteData = {
        vehicles: [
          createMockVehicle({ vin: "VIN1", make: "Toyota", model: "Camry" }),
          createMockVehicle({ vin: "VIN2", make: "Honda", model: "Civic" }),
          createMockVehicle({ vin: "VIN3", make: "Ford", model: "Focus" }),
        ],
        portalId: testPortal._id.toString(),
        userId: "5f9b2a63a6be2500170b0e90",
        origin: "New York, NY",
        destination: "Los Angeles, CA",
      };

      const response = await request(testApp)
        .post("/api/v1/quote")
        .send(quoteData)
        .expect(200);

      // Verify vehicles count
      expect(response.body.vehicles).toHaveLength(3);

      // Verify each vehicle has pricing data
      response.body.vehicles.forEach((vehicle: any) => {
        expect(vehicle).toHaveProperty("pricing");
        expect(vehicle.pricing).toHaveProperty("base");
        expect(vehicle.pricing).toHaveProperty("modifiers");
        expect(vehicle.pricing).toHaveProperty("totals");
      });
    });

    it("should return 400 for missing required fields", async () => {
      const invalidQuoteData = {
        // Missing required fields: origin, destination, vehicles
        portalId: testPortal._id.toString(),
        userId: "5f9b2a63a6be2500170b0e90",
      };

      const response = await request(testApp)
        .post("/api/v1/quote")
        .send(invalidQuoteData)
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 404 for non-existent portal", async () => {
      // Mock Portal.findById to return null for this specific test
      (Portal.findById as jest.MockedFunction<any>).mockResolvedValueOnce(null);

      const quoteData = {
        vehicles: [createMockVehicle()],
        portalId: "507f1f77bcf86cd799439099", // Non-existent ObjectId
        userId: "5f9b2a63a6be2500170b0e90",
        origin: "New York, NY",
        destination: "Los Angeles, CA",
      };

      const response = await request(testApp)
        .post("/api/v1/quote")
        .send(quoteData)
        .expect(404);

      expect(response.body).toHaveProperty("error");
    });

    it("should handle inoperable vehicles", async () => {
      const quoteData = {
        vehicles: [createMockVehicle({ isInoperable: true })],
        portalId: testPortal._id.toString(),
        userId: "5f9b2a63a6be2500170b0e90",
        origin: "New York, NY",
        destination: "Los Angeles, CA",
      };

      const response = await request(testApp)
        .post("/api/v1/quote")
        .send(quoteData)
        .expect(200);

      // Verify inoperable vehicle pricing includes inoperable modifier
      const vehicle = response.body.vehicles[0];
      expect(vehicle.isInoperable).toBe(true);
      expect(vehicle.pricing.modifiers.inoperable).toBeGreaterThan(0);
    });

    it("should handle oversize vehicles", async () => {
      const quoteData = {
        vehicles: [
          createMockVehicle({
            isOversize: true,
            pricingClass: "suv",
          }),
        ],
        portalId: testPortal._id.toString(),
        userId: "5f9b2a63a6be2500170b0e90",
        origin: "New York, NY",
        destination: "Los Angeles, CA",
      };

      const response = await request(testApp)
        .post("/api/v1/quote")
        .send(quoteData)
        .expect(200);

      // Verify oversize vehicle pricing includes oversize modifier
      const vehicle = response.body.vehicles[0];
      expect(vehicle.isOversize).toBe(true);
      expect(vehicle.pricing.modifiers.oversize).toBeGreaterThan(0);
    });

    it("should handle enclosed transport", async () => {
      const quoteData = {
        vehicles: [createMockVehicle({ transportType: "enclosed" })],
        portalId: testPortal._id.toString(),
        userId: "5f9b2a63a6be2500170b0e90",
        origin: "New York, NY",
        destination: "Los Angeles, CA",
      };

      const response = await request(testApp)
        .post("/api/v1/quote")
        .send(quoteData)
        .expect(200);

      // Verify enclosed transport pricing
      const vehicle = response.body.vehicles[0];
      expect(vehicle.transportType).toBe("enclosed");

      // Check that enclosed totals are different from open totals
      expect(vehicle.pricing.totals.one.enclosed.total).toBeGreaterThan(0);
      expect(vehicle.pricing.totals.one.enclosed.total).not.toBe(
        vehicle.pricing.totals.one.open.total,
      );
    });
  });
});
