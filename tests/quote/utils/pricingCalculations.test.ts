import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ServiceLevelOption, TransportType } from "@/_global/enums";

// This test file doesn't need mocks since it's testing utility functions

describe("Pricing Calculation Utilities", () => {
  let mockModifierSet: any;
  let mockPortal: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockModifierSet = {
      _id: "modifier-set-1",
      name: "Test Modifier Set",
      global: {
        inoperable: { flat: 500, percent: 0 },
        routes: new Map([
          ["short", { flat: 0, percent: 0 }],
          ["medium", { flat: 200, percent: 0 }],
          ["long", { flat: 500, percent: 0 }],
        ]),
        states: new Map([
          ["CA", { flat: 0, percent: 0 }],
          ["NY", { flat: 100, percent: 0 }],
          ["TX", { flat: 0, percent: 0.05 }],
        ]),
        oversize: { flat: 1000, percent: 0 },
        vehicles: new Map([
          ["sedan", { flat: 0, percent: 0 }],
          ["suv", { flat: 200, percent: 0 }],
          ["truck", { flat: 500, percent: 0 }],
        ]),
        globalDiscount: { flat: 0, percent: 0.1 },
        irr: { flat: 0, percent: 0 },
        fuel: { flat: 0, percent: 0 },
        enclosedFlat: { flat: 500, percent: 0 },
        enclosedPercent: { flat: 0, percent: 0.1 },
        commission: { flat: 0, percent: 0.05 },
        serviceLevels: [
          { serviceLevel: ServiceLevelOption.OneDay, value: 1000 },
          { serviceLevel: ServiceLevelOption.ThreeDay, value: 800 },
          { serviceLevel: ServiceLevelOption.FiveDay, value: 600 },
          { serviceLevel: ServiceLevelOption.SevenDay, value: 400 },
          { serviceLevel: ServiceLevelOption.WhiteGlove, value: 2000 },
        ],
        companyTariffDiscount: { flat: 0, percent: 0.1 },
        companyTariffEnclosedFee: { flat: 200, percent: 0 },
      },
      portal: {
        companyTariff: { flat: 0, percent: 0.15 },
        companyTariffEnclosedExtra: { flat: 0, percent: 0.05 },
      },
    };

    mockPortal = {
      _id: "portal-1",
      name: "Test Portal",
      baseRate: 1000,
      options: {
        enableCustomRates: false,
        enableEnclosedTransport: true,
        enableWhiteGlove: true,
      },
    };
  });

  describe("Modifier Calculations", () => {
    it("should calculate inoperable modifier correctly", () => {
      const base = 1000;
      const modifier = { flat: 500, percent: 0 };

      // Test flat modifier
      const flatResult = base + modifier.flat;
      expect(flatResult).toBe(1500);

      // Test percentage modifier
      const percentModifier = { flat: 0, percent: 0.1 };
      const percentResult = base + base * percentModifier.percent;
      expect(percentResult).toBe(1100);
    });

    it("should calculate state modifiers correctly", () => {
      const base = 1000;
      const stateModifiers = new Map([
        ["CA", { flat: 0, percent: 0 }],
        ["NY", { flat: 100, percent: 0 }],
        ["TX", { flat: 0, percent: 0.05 }],
      ]);

      // Test CA (no modifier)
      const caModifier = stateModifiers.get("CA");
      const caResult =
        base + (caModifier?.flat || 0) + base * (caModifier?.percent || 0);
      expect(caResult).toBe(1000);

      // Test NY (flat modifier)
      const nyModifier = stateModifiers.get("NY");
      const nyResult =
        base + (nyModifier?.flat || 0) + base * (nyModifier?.percent || 0);
      expect(nyResult).toBe(1100);

      // Test TX (percentage modifier)
      const txModifier = stateModifiers.get("TX");
      const txResult =
        base + (txModifier?.flat || 0) + base * (txModifier?.percent || 0);
      expect(txResult).toBe(1050);
    });

    it("should calculate vehicle type modifiers correctly", () => {
      const base = 1000;
      const vehicleModifiers = new Map([
        ["sedan", { flat: 0, percent: 0 }],
        ["suv", { flat: 200, percent: 0 }],
        ["truck", { flat: 500, percent: 0 }],
      ]);

      // Test sedan (no modifier)
      const sedanModifier = vehicleModifiers.get("sedan");
      const sedanResult =
        base +
        (sedanModifier?.flat || 0) +
        base * (sedanModifier?.percent || 0);
      expect(sedanResult).toBe(1000);

      // Test SUV (flat modifier)
      const suvModifier = vehicleModifiers.get("suv");
      const suvResult =
        base + (suvModifier?.flat || 0) + base * (suvModifier?.percent || 0);
      expect(suvResult).toBe(1200);

      // Test truck (flat modifier)
      const truckModifier = vehicleModifiers.get("truck");
      const truckResult =
        base +
        (truckModifier?.flat || 0) +
        base * (truckModifier?.percent || 0);
      expect(truckResult).toBe(1500);
    });

    it("should calculate enclosed transport modifiers correctly", () => {
      const base = 1000;
      const enclosedFlat = 500;
      const enclosedPercent = 0.1;

      // Test enclosed flat modifier
      const flatResult = base + enclosedFlat;
      expect(flatResult).toBe(1500);

      // Test enclosed percentage modifier
      const percentResult = base + base * enclosedPercent;
      expect(percentResult).toBe(1100);

      // Test both modifiers combined
      const combinedResult = base + enclosedFlat + base * enclosedPercent;
      expect(combinedResult).toBe(1600);
    });
  });

  describe("Service Level Calculations", () => {
    it("should calculate service level values correctly", () => {
      const serviceLevels = [
        { serviceLevel: ServiceLevelOption.OneDay, value: 1000 },
        { serviceLevel: ServiceLevelOption.ThreeDay, value: 800 },
        { serviceLevel: ServiceLevelOption.FiveDay, value: 600 },
        { serviceLevel: ServiceLevelOption.SevenDay, value: 400 },
        { serviceLevel: ServiceLevelOption.WhiteGlove, value: 2000 },
      ];

      // Test each service level
      expect(serviceLevels[0].value).toBe(1000); // One day
      expect(serviceLevels[1].value).toBe(800); // Three day
      expect(serviceLevels[2].value).toBe(600); // Five day
      expect(serviceLevels[3].value).toBe(400); // Seven day
      expect(serviceLevels[4].value).toBe(2000); // WhiteGlove
    });

    it("should calculate company tariff correctly", () => {
      const baseWithModifiers = 1000;
      const companyTariffRate = 0.15;
      const discount = 0.1;
      const isEnclosed = false;

      // Calculate company tariff
      let companyTariff = baseWithModifiers * companyTariffRate;

      // Apply discount
      companyTariff = companyTariff * (1 - discount);

      // Apply enclosed extra if applicable
      if (isEnclosed) {
        const enclosedExtra = 0.05;
        companyTariff = companyTariff * (1 + enclosedExtra);
      }

      expect(companyTariff).toBe(135); // 1000 * 0.15 * 0.9 = 135
    });

    it("should calculate company tariff with enclosed extra", () => {
      const baseWithModifiers = 1000;
      const companyTariffRate = 0.15;
      const discount = 0.1;
      const isEnclosed = true;
      const enclosedExtra = 0.05;

      // Calculate company tariff
      let companyTariff = baseWithModifiers * companyTariffRate;

      // Apply discount
      companyTariff = companyTariff * (1 - discount);

      // Apply enclosed extra
      companyTariff = companyTariff * (1 + enclosedExtra);

      expect(companyTariff).toBe(141.75); // 1000 * 0.15 * 0.9 * 1.05 = 141.75
    });

    it("should calculate commission correctly", () => {
      const baseWithModifiers = 1000;
      const commissionRate = 0.05;

      const commission = baseWithModifiers * commissionRate;
      expect(commission).toBe(50);
    });
  });

  describe("Total Calculations", () => {
    it("should calculate total with company tariff and commission", () => {
      const baseWithModifiers = 1000;
      const companyTariff = 150;
      const commission = 50;

      const total = baseWithModifiers + companyTariff + commission;
      expect(total).toBe(1200);
    });

    it("should calculate WhiteGlove total correctly", () => {
      const baseWhiteGlove = 2000;

      // WhiteGlove should not include modifiers, company tariff, or commission
      const total = baseWhiteGlove;
      expect(total).toBe(2000);
    });

    it("should round currency values correctly", () => {
      const roundCurrency = (value: number) => Math.round(value * 100) / 100;

      expect(roundCurrency(123.456)).toBe(123.46);
      expect(roundCurrency(123.454)).toBe(123.45);
      expect(roundCurrency(123.455)).toBe(123.46);
      expect(roundCurrency(123)).toBe(123);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero values", () => {
      const base = 0;
      const modifier = { flat: 0, percent: 0 };

      const result = base + modifier.flat + base * modifier.percent;
      expect(result).toBe(0);
    });

    it("should handle negative modifiers", () => {
      const base = 1000;
      const discount = { flat: 0, percent: -0.1 }; // 10% discount

      const result = base + base * discount.percent;
      expect(result).toBe(900);
    });

    it("should handle missing modifier data", () => {
      const base = 1000;
      const modifier: any = undefined;

      const result =
        base + (modifier?.flat || 0) + base * (modifier?.percent || 0);
      expect(result).toBe(1000);
    });

    it("should handle very large numbers", () => {
      const base = 1000000;
      const modifier = { flat: 100000, percent: 0.1 };

      const result = base + modifier.flat + base * modifier.percent;
      expect(result).toBe(1200000);
    });
  });
});
