import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { calculateTotalPricing } from "@/quote/services/calculateTotalPricing";
import {
  createMockVehicle,
  createMockPricingData,
  createMockPortal,
} from "../../utils/testDataFactory";

describe("calculateTotalPricing", () => {
  let mockVehicles: any[];
  let mockPortal: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock vehicles with pricing data
    const pricingData = createMockPricingData();
    mockVehicles = [
      {
        _id: "vehicle1",
        pricing: pricingData,
      },
      {
        _id: "vehicle2",
        pricing: {
          ...pricingData,
          base: 1200,
          totals: {
            whiteGlove: 2400,
            one: {
              open: {
                total: 1200,
                companyTariff: 180,
                commission: 60,
                totalWithCompanyTariffAndCommission: 1440,
              },
              enclosed: {
                total: 1320,
                companyTariff: 198,
                commission: 60,
                totalWithCompanyTariffAndCommission: 1578,
              },
            },
            three: {
              total: 960,
              companyTariff: 144,
              commission: 60,
              totalWithCompanyTariffAndCommission: 1164,
            },
            five: {
              total: 720,
              companyTariff: 108,
              commission: 60,
              totalWithCompanyTariffAndCommission: 888,
            },
            seven: {
              total: 480,
              companyTariff: 72,
              commission: 60,
              totalWithCompanyTariffAndCommission: 612,
            },
          },
        },
      },
    ];

    mockPortal = {
      _id: "portal1",
      name: "Test Portal",
      baseRate: 1000,
      options: {
        enableCustomRates: false,
        enableEnclosedTransport: true,
        enableWhiteGlove: true,
      },
    };
  });

  describe("Basic Aggregation", () => {
    it("should aggregate pricing from multiple vehicles", async () => {
      const result = await calculateTotalPricing(mockVehicles, mockPortal);

      expect(result).toHaveProperty("base");
      expect(result).toHaveProperty("modifiers");
      expect(result).toHaveProperty("totals");
    });

    it("should calculate correct base totals", async () => {
      const result = await calculateTotalPricing(mockVehicles, mockPortal);

      // Base should be sum of all vehicle bases
      expect(result.base).toBe(2200); // 1000 + 1200
    });

    it("should aggregate whiteGlove totals correctly", async () => {
      const result = await calculateTotalPricing(mockVehicles, mockPortal);

      // WhiteGlove should be sum of all vehicle whiteGlove values
      expect(result.totals.whiteGlove).toBe(4400); // 2000 + 2400
    });
  });

  describe("Service Level Aggregation", () => {
    it("should aggregate one-day open totals correctly", async () => {
      const result = await calculateTotalPricing(mockVehicles, mockPortal);

      const oneOpen = result.totals.one.open;
      expect(oneOpen.total).toBe(2200); // 1000 + 1200
      expect(oneOpen.companyTariff).toBe(330); // 150 + 180
      expect(oneOpen.commission).toBe(110); // 50 + 60
      expect(oneOpen.totalWithCompanyTariffAndCommission).toBe(2640); // 1200 + 1440
    });

    it("should aggregate one-day enclosed totals correctly", async () => {
      const result = await calculateTotalPricing(mockVehicles, mockPortal);

      const oneEnclosed = result.totals.one.enclosed;
      expect(oneEnclosed.total).toBe(2420); // 1100 + 1320
      expect(oneEnclosed.companyTariff).toBe(363); // 165 + 198
      expect(oneEnclosed.commission).toBe(110); // 50 + 60
      expect(oneEnclosed.totalWithCompanyTariffAndCommission).toBe(2893); // 1315 + 1578
    });

    it("should aggregate three-day totals correctly", async () => {
      const result = await calculateTotalPricing(mockVehicles, mockPortal);

      const three = result.totals.three;
      expect(three.total).toBe(1760); // 800 + 960
      expect(three.companyTariff).toBe(264); // 120 + 144
      expect(three.commission).toBe(110); // 50 + 60
      expect(three.totalWithCompanyTariffAndCommission).toBe(2134); // 970 + 1164
    });

    it("should aggregate five-day totals correctly", async () => {
      const result = await calculateTotalPricing(mockVehicles, mockPortal);

      const five = result.totals.five;
      expect(five.total).toBe(1320); // 600 + 720
      expect(five.companyTariff).toBe(198); // 90 + 108
      expect(five.commission).toBe(110); // 50 + 60
      expect(five.totalWithCompanyTariffAndCommission).toBe(1628); // 740 + 888
    });

    it("should aggregate seven-day totals correctly", async () => {
      const result = await calculateTotalPricing(mockVehicles, mockPortal);

      const seven = result.totals.seven;
      expect(seven.total).toBe(880); // 400 + 480
      expect(seven.companyTariff).toBe(132); // 60 + 72
      expect(seven.commission).toBe(110); // 50 + 60
      expect(seven.totalWithCompanyTariffAndCommission).toBe(1122); // 510 + 612
    });
  });

  describe("Modifier Aggregation", () => {
    it("should aggregate modifiers correctly", async () => {
      const result = await calculateTotalPricing(mockVehicles, mockPortal);

      expect(result.modifiers).toHaveProperty("inoperable");
      expect(result.modifiers).toHaveProperty("routes");
      expect(result.modifiers).toHaveProperty("states");
      expect(result.modifiers).toHaveProperty("oversize");
      expect(result.modifiers).toHaveProperty("vehicles");
      expect(result.modifiers).toHaveProperty("globalDiscount");
      expect(result.modifiers).toHaveProperty("portalDiscount");
      expect(result.modifiers).toHaveProperty("irr");
      expect(result.modifiers).toHaveProperty("fuel");
      expect(result.modifiers).toHaveProperty("enclosedFlat");
      expect(result.modifiers).toHaveProperty("enclosedPercent");
      expect(result.modifiers).toHaveProperty("commission");
      expect(result.modifiers).toHaveProperty("serviceLevels");
      expect(result.modifiers).toHaveProperty("companyTariffs");
    });

    it("should aggregate modifiers from all vehicles", async () => {
      const result = await calculateTotalPricing(mockVehicles, mockPortal);

      // Should aggregate modifiers from all vehicles (50 + 50 = 100)
      expect(result.modifiers.commission).toBe(100);
      expect(Array.isArray(result.modifiers.serviceLevels)).toBe(true);
      expect(Array.isArray(result.modifiers.companyTariffs)).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty vehicles array", async () => {
      const result = await calculateTotalPricing([], mockPortal);

      expect(result.base).toBe(0);
      expect(result.totals.whiteGlove).toBe(0);
      expect(result.totals.one.open.total).toBe(0);
    });

    it("should handle vehicles with missing pricing data", async () => {
      const vehiclesWithMissingPricing = [
        { ...createMockVehicle(), _id: "vehicle1", pricing: null },
        { ...createMockVehicle(), _id: "vehicle2", pricing: undefined },
        { ...createMockVehicle(), _id: "vehicle3", pricing: {} },
      ];

      const result = await calculateTotalPricing(
        vehiclesWithMissingPricing,
        mockPortal,
      );

      expect(result.base).toBe(0);
      expect(result.totals.whiteGlove).toBe(0);
    });

    it("should handle vehicles with partial pricing data", async () => {
      const vehiclesWithPartialPricing = [
        {
          ...createMockVehicle(),
          _id: "vehicle1",
          pricing: {
            base: 1000,
            totals: {
              whiteGlove: 2000,
              one: {
                open: {
                  total: 1000,
                  companyTariff: 150,
                  commission: 50,
                  totalWithCompanyTariffAndCommission: 1200,
                },
                enclosed: {
                  total: 1100,
                  companyTariff: 165,
                  commission: 50,
                  totalWithCompanyTariffAndCommission: 1315,
                },
              },
              three: {
                total: 800,
                companyTariff: 120,
                commission: 50,
                totalWithCompanyTariffAndCommission: 970,
              },
              five: {
                total: 600,
                companyTariff: 90,
                commission: 50,
                totalWithCompanyTariffAndCommission: 740,
              },
              seven: {
                total: 400,
                companyTariff: 60,
                commission: 50,
                totalWithCompanyTariffAndCommission: 510,
              },
            },
          },
        },
        {
          ...createMockVehicle(),
          _id: "vehicle2",
          pricing: {
            base: 500,
            totals: {
              whiteGlove: 1000,
              // Missing other service levels
            },
          },
        },
      ];

      const result = await calculateTotalPricing(
        vehiclesWithPartialPricing,
        mockPortal,
      );

      expect(result.base).toBe(1500); // 1000 + 500
      expect(result.totals.whiteGlove).toBe(3000); // 2000 + 1000
      // Other service levels should only include data from first vehicle
      expect(result.totals.one.open.total).toBe(1000);
    });
  });

  describe("Portal Options", () => {
    it("should use custom rates when enabled", async () => {
      const portalWithCustomRates = {
        ...mockPortal,
        options: {
          ...mockPortal.options,
          enableCustomRates: true,
        },
      };

      const result = await calculateTotalPricing(
        mockVehicles,
        portalWithCustomRates,
      );

      // Should use custom base calculation
      expect(result.base).toBeDefined();
    });

    it("should handle portal without options", async () => {
      const portalWithoutOptions = createMockPortal({
        _id: "portal1",
        name: "Test Portal",
        baseRate: 1000,
      });

      const result = await calculateTotalPricing(
        mockVehicles,
        portalWithoutOptions,
      );

      expect(result).toBeDefined();
      expect(result.base).toBe(2200);
    });
  });
});
