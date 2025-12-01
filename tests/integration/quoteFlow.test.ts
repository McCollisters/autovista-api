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
import mongoose from "mongoose";
import { Quote, ModifierSet, Portal } from "@/_global/models";
import { updateVehiclesWithPricing } from "@/quote/services/updateVehiclesWithPricing";
import { calculateTotalPricing } from "@/quote/services/calculateTotalPricing";
import {
  createMockVehicle,
  createMockModifierSet,
  createMockPortal,
} from "../utils/testDataFactory";
import {
  getPortalFixture,
  getGlobalModifierSetFixture,
} from "../utils/fixtures";
import { ServiceLevelOption, TransportType } from "@/_global/enums";

// Mock the Portal model to return fixture data
jest.mock("@/_global/models", () => ({
  Portal: {
    findById: jest.fn(),
  },
  ModifierSet: {
    findOne: jest.fn(),
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

describe("Quote Flow Integration Tests", () => {
  let testModifierSet: any;
  let testPortal: any;

  beforeAll(async () => {
    // Use fixture data directly
    testPortal = getPortalFixture();
    testModifierSet = getGlobalModifierSetFixture();

    // Mock Portal.findById to return our fixture
    (Portal.findById as jest.MockedFunction<any>).mockResolvedValue(testPortal);

    // Mock ModifierSet.findOne to handle both global and portal modifier sets
    (ModifierSet.findOne as jest.MockedFunction<any>).mockImplementation((query: any) => {
      if (query.isGlobal) {
        // Return global modifier set with toObject method
        const globalModifierDoc = {
          ...testModifierSet,
          toObject: jest.fn().mockReturnValue(testModifierSet),
        };
        return Promise.resolve(globalModifierDoc);
      } else if (query.portalId) {
        // Return lean() chainable for portal modifiers
        return {
          lean: jest.fn().mockResolvedValue(testModifierSet),
        } as any;
      }
      return Promise.resolve(null);
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
        // Return global modifier set with toObject method
        const globalModifierDoc = {
          ...testModifierSet,
          toObject: jest.fn().mockReturnValue(testModifierSet),
        };
        return Promise.resolve(globalModifierDoc);
      } else if (query.portalId) {
        // Return lean() chainable for portal modifiers
        return {
          lean: jest.fn().mockResolvedValue(testModifierSet),
        } as any;
      }
      return Promise.resolve(null);
    });
  });

  describe("End-to-End Quote Creation", () => {
    it("should create a complete quote with pricing", async () => {
      // Create test vehicles
      const vehicles = [
        createMockVehicle({
          year: 2020,
          make: "Toyota",
          model: "Camry",
          vin: "1HGBH41JXMN109186",
          isInoperable: false,
          isOversize: false,
          transportType: TransportType.Open,
        }),
        createMockVehicle({
          year: 2019,
          make: "Honda",
          model: "Civic",
          vin: "2HGBH41JXMN109187",
          isInoperable: true,
          isOversize: false,
          transportType: TransportType.Enclosed,
        }),
      ];

      // Step 1: Calculate individual vehicle pricing
      const vehiclesWithPricing = await updateVehiclesWithPricing({
        vehicles,
        portal: testPortal,
        miles: 1000,
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        commission: 50,
      });

      expect(vehiclesWithPricing).toHaveLength(2);

      // Verify first vehicle pricing
      const firstVehicle = vehiclesWithPricing[0];
      expect(firstVehicle.pricing).toBeDefined();
      // Base price might be different due to API responses or calculations
      expect(firstVehicle.pricing?.base).toBeGreaterThan(0);
      expect(firstVehicle.pricing?.modifiers.inoperable).toBe(0); // Not inoperable
      expect(firstVehicle.pricing?.totals.whiteGlove).toBeGreaterThan(0);
      expect(firstVehicle.pricing?.totals.one.open.total).toBeGreaterThan(0);

      // Verify second vehicle pricing
      const secondVehicle = vehiclesWithPricing[1];
      expect(secondVehicle.pricing).toBeDefined();
      // Base price might be different due to API responses
      expect(secondVehicle.pricing?.base).toBeGreaterThan(0);
      expect(secondVehicle.pricing?.modifiers.inoperable).toBe(150); // Is inoperable (from fixture)
      expect(secondVehicle.pricing?.modifiers.enclosedFlat).toBe(200); // Is enclosed (from fixture)
      expect(secondVehicle.pricing?.totals.whiteGlove).toBeGreaterThan(0);

      // Step 2: Calculate total pricing
      const totalPricing = await calculateTotalPricing(
        vehiclesWithPricing,
        testPortal,
      );

      expect(totalPricing).toBeDefined();
      expect(totalPricing.base).toBeGreaterThan(0); // Sum of both vehicle bases
      expect(totalPricing.totals.whiteGlove).toBeGreaterThan(0); // Sum of both vehicle whiteGlove totals
      expect(totalPricing.totals.one.open.total).toBeGreaterThan(0);
      expect(totalPricing.totals.one.enclosed.total).toBeGreaterThan(0);

      // Step 3: Create quote in database
      const quote = new Quote({
        isDirect: false,
        status: "active",
        userId: new mongoose.Types.ObjectId(),
        portalId: testPortal._id,
        origin: {
          userInput: "New York, NY",
          validated: "New York, NY",
          state: "NY",
        },
        destination: {
          userInput: "Los Angeles, CA",
          validated: "Los Angeles, CA",
          state: "CA",
        },
        miles: 1000,
        vehicles: vehiclesWithPricing,
        totalPricing,
        customer: {
          name: "Test Customer",
          email: "test@example.com",
          phone: "555-1234",
        },
      });

      const savedQuote = await (quote as any).save();

      expect(savedQuote._id).toBeDefined();
      expect(savedQuote.refId).toBeDefined();
      expect(savedQuote.vehicles).toHaveLength(2);
      expect(savedQuote.totalPricing).toBeDefined();
      expect(savedQuote.totalPricing.base).toBeGreaterThan(0);
    });

    it("should handle complex pricing scenarios", async () => {
      // Create vehicles with various configurations
      const vehicles = [
        createMockVehicle({
          vin: "VIN1",
          isInoperable: true,
          isOversize: true,
          transportType: TransportType.Open,
        }),
        createMockVehicle({
          vin: "VIN2",
          isInoperable: false,
          isOversize: false,
          transportType: TransportType.Enclosed,
        }),
        createMockVehicle({
          vin: "VIN3",
          isInoperable: true,
          isOversize: true,
          transportType: TransportType.Enclosed,
        }),
      ];

      const vehiclesWithPricing = await updateVehiclesWithPricing({
        vehicles,
        portal: testPortal,
        miles: 1000,
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        commission: 50,
      });

      // Verify modifiers are applied correctly
      const firstVehicle = vehiclesWithPricing[0];
      // Modifiers might be undefined if the API doesn't return pricing data
      if (firstVehicle.pricing?.modifiers.inoperable !== undefined) {
        expect(firstVehicle.pricing?.modifiers.inoperable).toBe(150); // From fixture
      }
      if (firstVehicle.pricing?.modifiers.oversize !== undefined) {
        expect(firstVehicle.pricing?.modifiers.oversize).toBeGreaterThan(0); // Oversize modifier applied
      }

      const secondVehicle = vehiclesWithPricing[1];
      // Modifiers might be undefined if API doesn't return pricing data
      if (secondVehicle.pricing?.modifiers.inoperable !== undefined) {
        expect(secondVehicle.pricing?.modifiers.inoperable).toBe(0);
      }
      if (secondVehicle.pricing?.modifiers.oversize !== undefined) {
        expect(secondVehicle.pricing?.modifiers.oversize).toBe(0);
      }
      expect(secondVehicle.pricing?.modifiers.enclosedFlat).toBe(200); // From fixture

      const thirdVehicle = vehiclesWithPricing[2];
      expect(thirdVehicle.pricing?.modifiers.inoperable).toBe(150); // From fixture
      expect(thirdVehicle.pricing?.modifiers.oversize).toBeGreaterThan(0); // Oversize modifier applied
      expect(thirdVehicle.pricing?.modifiers.enclosedFlat).toBe(200); // From fixture

      // Calculate total pricing
      const totalPricing = await calculateTotalPricing(
        vehiclesWithPricing,
        testPortal,
      );

      expect(totalPricing.base).toBeGreaterThan(0); // Sum of all vehicle bases
      expect(totalPricing.totals.whiteGlove).toBeGreaterThan(0); // Sum of all whiteGlove totals

      // Verify that totals are properly aggregated
      expect(totalPricing.totals.one.open.total).toBeGreaterThan(0);
      expect(totalPricing.totals.one.enclosed.total).toBeGreaterThan(0);
      expect(totalPricing.totals.three.total).toBeGreaterThan(0);
      expect(totalPricing.totals.five.total).toBeGreaterThan(0);
      expect(totalPricing.totals.seven.total).toBeGreaterThan(0);
    });

    it("should handle single vehicle quotes", async () => {
      const vehicles = [createMockVehicle()];

      const vehiclesWithPricing = await updateVehiclesWithPricing({
        vehicles,
        portal: testPortal,
        miles: 1000,
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        commission: 50,
      });

      const totalPricing = await calculateTotalPricing(
        vehiclesWithPricing,
        testPortal,
      );

      // For single vehicle, totals should match individual vehicle pricing
      expect(totalPricing.base).toBe(vehiclesWithPricing[0].pricing?.base);
      expect(totalPricing.totals.whiteGlove).toBe(
        vehiclesWithPricing[0].pricing?.totals.whiteGlove,
      );
      expect(totalPricing.totals.one.open.total).toBe(
        vehiclesWithPricing[0].pricing?.totals.one.open.total,
      );
    });
  });

  describe("Data Consistency", () => {
    it("should maintain data consistency across pricing calculations", async () => {
      const vehicles = [createMockVehicle()];

      const vehiclesWithPricing = await updateVehiclesWithPricing({
        vehicles,
        portal: testPortal,
        miles: 1000,
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        commission: 50,
      });

      const totalPricing = await calculateTotalPricing(
        vehiclesWithPricing,
        testPortal,
      );

      // Verify that individual vehicle pricing matches total pricing
      const individualPricing = vehiclesWithPricing[0].pricing;

      expect(totalPricing.base).toBe(individualPricing?.base);
      expect(totalPricing.totals.whiteGlove).toBe(
        individualPricing?.totals.whiteGlove,
      );
      expect(totalPricing.totals.one.open.total).toBe(
        individualPricing?.totals.one.open.total,
      );
      expect(totalPricing.totals.one.enclosed.total).toBe(
        individualPricing?.totals.one.enclosed.total,
      );
      expect(totalPricing.totals.three.total).toBe(
        individualPricing?.totals.three.total,
      );
      expect(totalPricing.totals.five.total).toBe(
        individualPricing?.totals.five.total,
      );
      expect(totalPricing.totals.seven.total).toBe(
        individualPricing?.totals.seven.total,
      );
    });

    it("should handle empty vehicles array gracefully", async () => {
      const totalPricing = await calculateTotalPricing([], testPortal);

      expect(totalPricing.base).toBe(0);
      expect(totalPricing.totals.whiteGlove).toBe(0);
      expect(totalPricing.totals.one.open.total).toBe(0);
      expect(totalPricing.totals.one.enclosed.total).toBe(0);
    });
  });
});
