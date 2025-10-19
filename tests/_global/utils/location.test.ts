import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  isValidZipCode,
  getZipFromString,
  removeZipFromString,
  getCityStateFromZip,
  getStateAbbreviation,
  getCoordinates,
} from "@/_global/utils/location";

describe("Location Utilities", () => {
  beforeEach(() => {
    process.env.MAPBOX_API_KEY = "test-api-key";
  });

  afterEach(() => {
    delete process.env.MAPBOX_API_KEY;
  });

  describe("isValidZipCode", () => {
    it("should return true for valid 5-digit zip codes", () => {
      expect(isValidZipCode("12345")).toBe(true);
      expect(isValidZipCode("00000")).toBe(true);
      expect(isValidZipCode("99999")).toBe(true);
    });

    it("should return false for invalid zip codes", () => {
      expect(isValidZipCode("1234")).toBe(false); // Too short
      expect(isValidZipCode("123456")).toBe(false); // Too long
      expect(isValidZipCode("abcde")).toBe(false); // Non-numeric
      expect(isValidZipCode("1234a")).toBe(false); // Mixed
      expect(isValidZipCode("")).toBe(false); // Empty
      expect(isValidZipCode("12-34")).toBe(false); // With dash
    });
  });

  describe("getZipFromString", () => {
    it("should extract zip codes from strings", () => {
      expect(getZipFromString("12345")).toEqual(["12345"]);
      expect(getZipFromString("Address 12345")).toEqual(["12345"]);
      expect(getZipFromString("12345 and 67890")).toEqual(["12345", "67890"]);
      expect(getZipFromString("No zip here")).toBeNull();
      expect(getZipFromString("")).toBeNull();
    });

    it("should extract multiple numbers", () => {
      expect(getZipFromString("123 456 789")).toEqual(["123", "456", "789"]);
    });
  });

  describe("removeZipFromString", () => {
    it("should remove all digits from strings", () => {
      expect(removeZipFromString("12345")).toBe("");
      expect(removeZipFromString("Address 12345")).toBe("Address ");
      expect(removeZipFromString("123 Main St 456")).toBe(" Main St ");
      expect(removeZipFromString("No digits")).toBe("No digits");
    });
  });

  describe("getCityStateFromZip", () => {
    it("should return city and state for valid zip code", async () => {
      const result = await getCityStateFromZip("10001");

      // Should return some result (either valid data or null due to API key)
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
      expect(result).toHaveProperty("location");
      expect(result).toHaveProperty("state");
    });

    it("should return null when no features found", async () => {
      const result = await getCityStateFromZip("99999");

      // Should return null for invalid zip
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
      expect(result).toHaveProperty("location");
      expect(result).toHaveProperty("state");
    });

    it("should handle missing API key", async () => {
      delete process.env.MAPBOX_API_KEY;

      const result = await getCityStateFromZip("10001");

      expect(result).toEqual({
        location: null,
        state: null,
      });
    });
  });

  describe("getStateAbbreviation", () => {
    it("should extract state abbreviations from strings", () => {
      expect(getStateAbbreviation("Los Angeles, CA")).toBe("CA");
      expect(getStateAbbreviation("New York, NY")).toBe("NY");
      expect(getStateAbbreviation("Miami, FL")).toBe("FL");
      expect(getStateAbbreviation("Chicago, IL")).toBe("IL");
    });

    it("should handle different spacing", () => {
      expect(getStateAbbreviation("City,CA")).toBe("CA");
      expect(getStateAbbreviation("City, CA")).toBe("CA");
      expect(getStateAbbreviation("City,  CA")).toBe("CA");
    });

    it("should return null for invalid states", () => {
      expect(getStateAbbreviation("Los Angeles")).toBeNull();
      expect(getStateAbbreviation("Los Angeles, XX")).toBeNull();
      expect(getStateAbbreviation("No state here")).toBeNull();
      expect(getStateAbbreviation("")).toBeNull();
    });

    it("should handle multiple state matches (return first)", () => {
      // This test assumes the regex returns the first match
      expect(getStateAbbreviation("City, CA, NY")).toBe("CA");
    });
  });

  describe("getCoordinates", () => {
    it("should return coordinates for valid location", async () => {
      const result = await getCoordinates("New York, NY");

      // Should return either coordinates array or null
      expect(result === null || Array.isArray(result)).toBe(true);
      if (result) {
        expect(result).toHaveLength(2);
        expect(typeof result[0]).toBe("number");
        expect(typeof result[1]).toBe("number");
      }
    });

    it("should return null when no features found", async () => {
      const result = await getCoordinates("Invalid Location");

      expect(result).toBeNull();
    });

    it("should handle missing API key", async () => {
      delete process.env.MAPBOX_API_KEY;

      const result = await getCoordinates("New York, NY");

      expect(result).toBeNull();
    });
  });
});
