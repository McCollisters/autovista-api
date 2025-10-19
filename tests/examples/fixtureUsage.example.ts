/**
 * Example of how to use JSON fixtures in your tests
 *
 * This file demonstrates the recommended approach for using
 * JSON fixtures instead of complex factory functions.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  getPortalFixture,
  getGlobalModifierSetFixture,
  getQuoteFixture,
  createMockPortal,
  createMockQuote,
} from "../utils/fixtures";

describe("Fixture Usage Examples", () => {
  describe("Using pre-defined fixtures", () => {
    it("should load portal fixture with all required fields", () => {
      const portal = getPortalFixture();

      expect(portal._id).toBe("507f1f77bcf86cd799439011");
      expect(portal.companyName).toBe("Test Auto Transport Co");
      expect(portal.status).toBe("active");
      expect(portal.options.enableCustomRates).toBe(true);
      expect(portal.customRates).toHaveLength(3);
    });

    it("should load global modifier set with service levels", () => {
      const modifierSet = getGlobalModifierSetFixture();

      expect(modifierSet._id).toBe("507f1f77bcf86cd799439012");
      expect(modifierSet.isGlobal).toBe(true);
      expect(modifierSet.serviceLevels).toHaveLength(4);
      expect(modifierSet.serviceLevels[0].serviceLevelOption).toBe("1");
    });

    it("should load quote with complete pricing data", () => {
      const quote = getQuoteFixture();

      expect(quote._id).toBe("507f1f77bcf86cd799439014");
      expect(quote.vehicles).toHaveLength(1);
      expect(quote.vehicles[0].pricing.totals.whiteGlove).toBe(2000);
      expect(quote.totalPricing.totals.one.open.total).toBe(1500);
    });
  });

  describe("Using factory functions with overrides", () => {
    it("should create portal with custom company name", () => {
      const portal = createMockPortal({
        companyName: "Custom Transport Co",
        status: "inactive",
      });

      expect(portal.companyName).toBe("Custom Transport Co");
      expect(portal.status).toBe("inactive");
      expect(portal._id).toBe("507f1f77bcf86cd799439011"); // Original ID preserved
    });

    it("should create quote with multiple vehicles", () => {
      const quote = createMockQuote({
        vehicles: [
          { make: "BMW", model: "X5", pricingClass: "suv" },
          { make: "Mercedes", model: "C-Class", pricingClass: "sedan" },
        ],
      });

      expect(quote.vehicles).toHaveLength(2);
      expect(quote.vehicles[0].make).toBe("BMW");
      expect(quote.vehicles[1].make).toBe("Mercedes");
    });
  });

  describe("Integration test example", () => {
    it("should work with real database operations", async () => {
      // Load fixtures
      const portalData = getPortalFixture();
      const modifierSetData = getGlobalModifierSetFixture();
      const quoteData = getQuoteFixture();

      // Use in your test logic
      // const portal = await Portal.create(portalData);
      // const modifierSet = await ModifierSet.create(modifierSetData);
      // const quote = await Quote.create(quoteData);

      // Your test assertions here
      expect(portalData._id).toBeDefined();
      expect(modifierSetData.serviceLevels).toBeDefined();
      expect(quoteData.vehicles).toBeDefined();
    });
  });
});
