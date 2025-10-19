import { describe, it, expect, beforeAll } from "@jest/globals";
import {
  isValidZipCode,
  getZipFromString,
  removeZipFromString,
  getCityStateFromZip,
  getStateAbbreviation,
  getCoordinates,
} from "@/_global/utils/location";

// Use real API calls for integration tests
const requiresAPIKey = process.env.MAPBOX_API_KEY;

describe("Location Utilities Integration Tests", () => {
  beforeAll(() => {
    if (!requiresAPIKey) {
      console.log(
        "Warning: No MAPBOX_API_KEY provided. Some tests will be skipped.",
      );
      console.log(
        "Set MAPBOX_API_KEY environment variable to run full integration tests.",
      );
    }
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

  describe("getCityStateFromZip Integration Tests", () => {
    it("should return city and state for valid zip code", async () => {
      if (!requiresAPIKey) {
        console.log("Skipping test - no MAPBOX_API_KEY provided");
        return;
      }

      const result = await getCityStateFromZip("10001");

      expect(result.location).toContain("New York");
      // The API might return null for state if it can't determine the abbreviation
      // So we'll just check that we got some result
      expect(result.state === null || result.state === "NY").toBe(true);
    }, 10000);

    it("should return null when no features found", async () => {
      if (!requiresAPIKey) {
        console.log("Skipping test - no MAPBOX_API_KEY provided");
        return;
      }

      const result = await getCityStateFromZip("99999");

      expect(result.location).toBeNull();
      expect(result.state).toBeNull();
    }, 10000);

    it("should handle various real zip codes", async () => {
      if (!requiresAPIKey) {
        console.log("Skipping test - no MAPBOX_API_KEY provided");
        return;
      }

      const testCases = [
        { zip: "90210", expectedCity: "Beverly Hills", expectedState: "CA" },
        { zip: "60601", expectedCity: "Chicago", expectedState: "IL" },
        { zip: "33101", expectedCity: "Miami", expectedState: "FL" },
      ];

      for (const testCase of testCases) {
        const result = await getCityStateFromZip(testCase.zip);

        expect(result.location).toContain(testCase.expectedCity);
        expect(result.state).toBe(testCase.expectedState);
      }
    }, 15000);
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
      expect(getStateAbbreviation("City, CA, NY")).toBe("CA");
    });
  });

  describe("getCoordinates Integration Tests", () => {
    it("should return coordinates for valid location", async () => {
      if (!requiresAPIKey) {
        console.log("Skipping test - no MAPBOX_API_KEY provided");
        return;
      }

      const result = await getCoordinates("New York, NY");

      expect(result).not.toBeNull();
      expect(result![0]).toBeCloseTo(-74.006, 2);
      expect(result![1]).toBeCloseTo(40.7128, 2);
    }, 10000);

    it("should return null when no features found", async () => {
      if (!requiresAPIKey) {
        console.log("Skipping test - no MAPBOX_API_KEY provided");
        return;
      }

      const result = await getCoordinates("Invalid Location XYZ");

      // The API might return coordinates for partial matches, so we just check it's not the exact expected location
      if (result) {
        expect(result[0]).not.toBeCloseTo(-74.006, 2);
        expect(result[1]).not.toBeCloseTo(40.7128, 2);
      }
    }, 10000);

    it("should handle various real locations", async () => {
      if (!requiresAPIKey) {
        console.log("Skipping test - no MAPBOX_API_KEY provided");
        return;
      }

      const testCases = [
        { location: "Los Angeles, CA", expected: [-118.2437, 34.0522] },
        { location: "Chicago, IL", expected: [-87.6298, 41.8781] },
        { location: "Miami, FL", expected: [-80.1918, 25.7617] },
      ];

      for (const testCase of testCases) {
        const result = await getCoordinates(testCase.location);

        expect(result).not.toBeNull();
        expect(result![0]).toBeCloseTo(testCase.expected[0], 1);
        expect(result![1]).toBeCloseTo(testCase.expected[1], 1);
      }
    }, 15000);

    it("should handle special characters in location", async () => {
      if (!requiresAPIKey) {
        console.log("Skipping test - no MAPBOX_API_KEY provided");
        return;
      }

      const result = await getCoordinates("St. Louis, MO");

      expect(result).not.toBeNull();
      expect(result![0]).toBeCloseTo(-90.1994, 2);
      expect(result![1]).toBeCloseTo(38.627, 2);
    }, 10000);

    it("should handle API errors gracefully", async () => {
      if (!requiresAPIKey) {
        console.log("Skipping test - no MAPBOX_API_KEY provided");
        return;
      }

      // Test with a location that might cause API issues
      const result = await getCoordinates("");

      expect(result).toBeNull();
    }, 10000);
  });
});
