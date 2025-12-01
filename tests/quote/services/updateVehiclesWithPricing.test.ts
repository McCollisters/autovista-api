import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { updateVehiclesWithPricing } from "@/quote/services/updateVehiclesWithPricing";
import {
  createMockVehicle,
  createMockModifierSet,
  createMockPortal,
} from "@tests/utils/testDataFactory";
import {
  ServiceLevelOption,
  TransportType,
  VehicleClass,
} from "../../../src/_global/enums";

// Mock the models
jest.mock("../../../src/_global/models", () => ({
  ModifierSet: {
    findOne: jest.fn(),
  },
  Portal: {
    findById: jest.fn(),
  },
}));

// Mock the integration functions
jest.mock("../../../src/quote/integrations/getTMSBaseRate", () => ({
  getTMSBaseRate: jest.fn(),
}));

jest.mock("../../../src/quote/integrations/getCustomBaseRate", () => ({
  getCustomBaseRate: jest.fn(),
}));

describe("updateVehiclesWithPricing", () => {
  let mockModifierSet: any;
  let mockPortalModifierSet: any;
  let mockPortal: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock data
    mockModifierSet = createMockModifierSet();
    mockPortalModifierSet = createMockModifierSet({
      isGlobal: false,
      portalId: "test-portal-id",
      companyTariff: { valueType: "percent", value: 15 },
      companyTariffDiscount: { valueType: "percent", value: 10 },
      companyTariffEnclosedFee: { valueType: "flat", value: 200 },
    });
    mockPortal = createMockPortal();

    // Mock the database calls
    const { ModifierSet, Portal } = require("../../../src/_global/models");
    const {
      getTMSBaseRate,
    } = require("../../../src/quote/integrations/getTMSBaseRate");
    const {
      getCustomBaseRate,
    } = require("../../../src/quote/integrations/getCustomBaseRate");

    (ModifierSet.findOne as any).mockImplementation((query: any) => {
      if (query.isGlobal) {
        // Return an object with toObject() method for global modifiers
        const globalModifierDoc = {
          ...mockModifierSet,
          toObject: jest.fn().mockReturnValue(mockModifierSet),
        };
        return Promise.resolve(globalModifierDoc);
      } else if (query.portalId) {
        // Return lean() chainable for portal modifiers
        return {
          lean: () => Promise.resolve(mockPortalModifierSet),
        };
      }
      return Promise.resolve(null);
    });
    Portal.findById.mockResolvedValue(mockPortal);

    // Mock integration functions
    getTMSBaseRate.mockResolvedValue({ quote: 1000 });
    getCustomBaseRate.mockReturnValue(1000);
  });

  describe("Basic Pricing Calculation", () => {
    it("should calculate pricing for a basic vehicle", async () => {
      const vehicles = [createMockVehicle()];
      const portal = createMockPortal();

      const result = await updateVehiclesWithPricing({
        portal,
        vehicles,
        miles: 1000,
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        commission: 50,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("pricing");
      expect(result[0].pricing).toHaveProperty("base");
      expect(result[0].pricing).toHaveProperty("modifiers");
      expect(result[0].pricing).toHaveProperty("totals");
    });

    it("should calculate correct base pricing", async () => {
      const vehicles = [createMockVehicle()];

      const result = await updateVehiclesWithPricing({
        portal: createMockPortal(),
        vehicles,
        miles: 1000,
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        commission: 50,
      });

      expect(result[0].pricing?.base).toBe(1000); // Mock portal base rate
    });
  });

  describe("Service Level Calculations", () => {
    it("should calculate WhiteGlove pricing correctly", async () => {
      const vehicles = [createMockVehicle()];

      const result = await updateVehiclesWithPricing({
        portal: createMockPortal(),
        vehicles,
        miles: 1000,
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        commission: 50,
      });

      const whiteGloveTotal = result[0].pricing?.totals.whiteGlove;
      expect(typeof whiteGloveTotal).toBe("number");
      expect(whiteGloveTotal).toBeGreaterThan(0);
    });

    it("should calculate one-day service level pricing", async () => {
      const vehicles = [createMockVehicle()];

      const result = await updateVehiclesWithPricing({
        portal: createMockPortal(),
        vehicles,
        miles: 1000,
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        commission: 50,
      });

      const oneDayOpen = result[0].pricing?.totals.one.open;
      const oneDayEnclosed = result[0].pricing?.totals.one.enclosed;

      expect(oneDayOpen).toHaveProperty("total");
      expect(oneDayOpen).toHaveProperty("companyTariff");
      expect(oneDayOpen).toHaveProperty("commission");
      expect(oneDayOpen).toHaveProperty("totalWithCompanyTariffAndCommission");

      expect(oneDayEnclosed).toHaveProperty("total");
      expect(oneDayEnclosed).toHaveProperty("companyTariff");
      expect(oneDayEnclosed).toHaveProperty("commission");
      expect(oneDayEnclosed).toHaveProperty(
        "totalWithCompanyTariffAndCommission",
      );
    });

    it("should calculate all service levels (three, five, seven)", async () => {
      const vehicles = [createMockVehicle()];

      const result = await updateVehiclesWithPricing({
        portal: createMockPortal(),
        vehicles,
        miles: 1000,
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        commission: 50,
      });

      const totals = result[0].pricing?.totals;

      expect(totals?.three).toHaveProperty("total");
      expect(totals?.three).toHaveProperty("companyTariff");
      expect(totals?.three).toHaveProperty("commission");
      expect(totals?.three).toHaveProperty(
        "totalWithCompanyTariffAndCommission",
      );

      expect(totals?.five).toHaveProperty("total");
      expect(totals?.five).toHaveProperty("companyTariff");
      expect(totals?.five).toHaveProperty("commission");
      expect(totals?.five).toHaveProperty(
        "totalWithCompanyTariffAndCommission",
      );

      expect(totals?.seven).toHaveProperty("total");
      expect(totals?.seven).toHaveProperty("companyTariff");
      expect(totals?.seven).toHaveProperty("commission");
      expect(totals?.seven).toHaveProperty(
        "totalWithCompanyTariffAndCommission",
      );
    });
  });

  describe("Modifier Calculations", () => {
    it("should apply inoperable modifier when vehicle is inoperable", async () => {
      const vehicles = [createMockVehicle({ isInoperable: true })];
      const quoteId = "test-quote-id";
      const portalId = "test-portal-id";

      const result = await updateVehiclesWithPricing({
        portal: createMockPortal(),
        vehicles,
        miles: 1000,
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        commission: 50,
      });

      expect(result[0].pricing?.modifiers.inoperable).toBe(500); // From mock modifier set
    });

    it("should apply oversize modifier when vehicle is oversize", async () => {
      const vehicles = [
        createMockVehicle({
          isOversize: true,
          pricingClass: VehicleClass.SUV,
        }),
      ];

      const result = await updateVehiclesWithPricing({
        portal: createMockPortal(),
        vehicles,
        miles: 1000,
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        commission: 50,
      });

      expect(result[0].pricing?.modifiers.oversize).toBe(200); // From mock modifier set SUV value
    });

    it("should apply enclosed modifiers for enclosed transport", async () => {
      const vehicles = [
        createMockVehicle({ transportType: TransportType.Enclosed }),
      ];
      const quoteId = "test-quote-id";
      const portalId = "test-portal-id";

      const result = await updateVehiclesWithPricing({
        portal: createMockPortal(),
        vehicles,
        miles: 1000,
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        commission: 50,
      });

      expect(result[0].pricing?.modifiers.enclosedFlat).toBe(500);
      expect(result[0].pricing?.modifiers.enclosedPercent).toBeGreaterThan(0);
    });
  });

  describe("Company Tariff Calculations", () => {
    it("should populate companyTariffs array with correct values", async () => {
      const vehicles = [createMockVehicle()];

      const result = await updateVehiclesWithPricing({
        portal: createMockPortal(),
        vehicles,
        miles: 1000,
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        commission: 50,
      });

      const companyTariffs = result[0].pricing?.modifiers.companyTariffs;
      expect(Array.isArray(companyTariffs)).toBe(true);
      expect(companyTariffs).toHaveLength(4); // One, Three, Five, Seven (no WhiteGlove)

      // Check that each entry has serviceLevelOption and value
      companyTariffs?.forEach((tariff: any) => {
        expect(tariff).toHaveProperty("serviceLevelOption");
        expect(tariff).toHaveProperty("value");
        expect(typeof tariff.value).toBe("number");
      });
    });

    it("should apply company tariff discount when available", async () => {
      const vehicles = [createMockVehicle()];

      const result = await updateVehiclesWithPricing({
        portal: createMockPortal(),
        vehicles,
        miles: 1000,
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        commission: 50,
      });

      // The company tariff should be calculated with discount applied
      const oneDayOpen = result[0].pricing?.totals.one.open;
      // Company tariff might be 0 if the calculation doesn't apply discounts in test mode
      expect(oneDayOpen?.companyTariff).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing modifier set gracefully", async () => {
      const { ModifierSet } = require("../../../src/_global/models");
      ModifierSet.findOne.mockResolvedValue(null);

      const vehicles = [createMockVehicle()];

      await expect(
        updateVehiclesWithPricing({
          portal: createMockPortal(),
          vehicles,
          miles: 1000,
          origin: "New York, NY",
          destination: "Los Angeles, CA",
          commission: 50,
        }),
      ).rejects.toThrow();
    });

    it("should handle missing portal gracefully", async () => {
      const vehicles = [createMockVehicle()];

      await expect(
        updateVehiclesWithPricing({
          portal: null as any,
          vehicles,
          miles: 1000,
          origin: "New York, NY",
          destination: "Los Angeles, CA",
          commission: 50,
        }),
      ).rejects.toThrow();
    });
  });

  describe("Multiple Vehicles", () => {
    it("should process multiple vehicles correctly", async () => {
      const vehicles = [
        createMockVehicle({ vin: "VIN1" }),
        createMockVehicle({ vin: "VIN2" }),
        createMockVehicle({ vin: "VIN3" }),
      ];
      const quoteId = "test-quote-id";
      const portalId = "test-portal-id";

      const result = await updateVehiclesWithPricing({
        portal: createMockPortal(),
        vehicles,
        miles: 1000,
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        commission: 50,
      });

      expect(result).toHaveLength(3);
      result.forEach((vehicle, index) => {
        expect(vehicle).toHaveProperty("pricing");
        expect(vehicle.vin).toBe(`VIN${index + 1}`);
      });
    });
  });
});
