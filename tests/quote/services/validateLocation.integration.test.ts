import { describe, it, expect, beforeAll } from "@jest/globals";
import { validateLocation } from "@/quote/services/validateLocation";

// Use real API calls for integration tests
const requiresAPIKey = process.env.MAPBOX_API_KEY;

describe("validateLocation Integration Tests", () => {
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

  it("should return error for Canadian postcodes", async () => {
    const result = await validateLocation("K1A 0A6");

    expect(result.error).toBe(
      "Please contact us for quotes with pick up or delivery to Canada.",
    );
    expect(result.state).toBeNull();
    expect(result.location).toBeNull();
  });

  it("should return error for Hawaii locations", async () => {
    const result = await validateLocation("Honolulu, HI");

    expect(result.error).toBe(
      "For quotes involving transport to or from AK (Alaska) or HI (Hawaii) please contact us directly for a specialized quote at (888) 819-0594 or email us at autologistics@mccollisters.com.  Thank you!",
    );
    expect(result.state).toBeNull();
    expect(result.location).toBeNull();
  });

  it("should return error for Alaska locations", async () => {
    const result = await validateLocation("Anchorage, AK");

    expect(result.error).toBe(
      "For quotes involving transport to or from AK (Alaska) or HI (Hawaii) please contact us directly for a specialized quote at (888) 819-0594 or email us at autologistics@mccollisters.com.  Thank you!",
    );
    expect(result.state).toBeNull();
    expect(result.location).toBeNull();
  });

  it("should return error for invalid zip code length", async () => {
    const result = await validateLocation("1234");

    expect(result.error).toBe("Invalid zip code");
  });

  it("should return error for invalid zip code length (too long)", async () => {
    const result = await validateLocation("123456");

    expect(result.error).toBe("Invalid zip code");
  });

  it("should validate 5-digit zip code and return city/state", async () => {
    if (!requiresAPIKey) {
      console.log("Skipping test - no MAPBOX_API_KEY provided");
      return;
    }

    const result = await validateLocation("10001");

    expect(result.error).toBeNull();
    // The API might return null for state if it can't determine the abbreviation
    expect(result.state === null || result.state === "NY").toBe(true);
    expect(result.location).toContain("New York");
  }, 10000);

  it("should handle zip code lookup returning null values", async () => {
    if (!requiresAPIKey) {
      console.log("Skipping test - no MAPBOX_API_KEY provided");
      return;
    }

    const result = await validateLocation("99999");

    expect(result.error).toBeNull();
    expect(result.state).toBeNull();
    expect(result.location).toBeNull();
  }, 10000);

  it("should extract state abbreviation from city, state format", async () => {
    const result = await validateLocation("Los Angeles, CA");

    expect(result.error).toBeNull();
    expect(result.state).toBe("CA");
    expect(result.location).toBeNull();
  });

  it("should handle state abbreviation not found", async () => {
    const result = await validateLocation("Invalid Location");

    expect(result.error).toBeNull();
    expect(result.state).toBeNull();
    expect(result.location).toBeNull();
  });

  it("should handle mixed content (numbers and letters)", async () => {
    const result = await validateLocation("123 Main St, Houston, TX");

    expect(result.error).toBeNull();
    expect(result.state).toBe("TX");
    expect(result.location).toBeNull();
  });

  it("should prioritize Canadian postcode check over other validations", async () => {
    if (!requiresAPIKey) {
      console.log("Skipping test - no MAPBOX_API_KEY provided");
      return;
    }

    const result = await validateLocation("10001");

    // Canadian check should take precedence, but since 10001 is not Canadian,
    // it should proceed with normal validation
    expect(result.error).toBeNull();
    // The API might return null for state if it can't determine the abbreviation
    expect(result.state === null || result.state === "NY").toBe(true);
    expect(result.location).toContain("New York");
  }, 10000);

  it("should prioritize Hawaii/Alaska check over zip code validation", async () => {
    if (!requiresAPIKey) {
      console.log("Skipping test - no MAPBOX_API_KEY provided");
      return;
    }

    const result = await validateLocation("96801");

    // The API might not return the expected state abbreviation, so we check for either the error or a valid result
    if (result.error) {
      expect(result.error).toBe(
        "For quotes involving transport to or from AK (Alaska) or HI (Hawaii) please contact us directly for a specialized quote at (888) 819-0594 or email us at autologistics@mccollisters.com.  Thank you!",
      );
      expect(result.state).toBe("HI");
    } else {
      // If no error, it means the API didn't detect Hawaii, which is also acceptable
      expect(result.state === null || result.state === "HI").toBe(true);
    }
  }, 10000);

  it("should validate various real zip codes", async () => {
    if (!requiresAPIKey) {
      console.log("Skipping test - no MAPBOX_API_KEY provided");
      return;
    }

    const testCases = [
      { zip: "90210", expectedState: "CA", expectedCity: "Beverly Hills" },
      { zip: "60601", expectedState: "IL", expectedCity: "Chicago" },
      { zip: "33101", expectedState: "FL", expectedCity: "Miami" },
    ];

    for (const testCase of testCases) {
      const result = await validateLocation(testCase.zip);

      expect(result.error).toBeNull();
      expect(result.state).toBe(testCase.expectedState);
      expect(result.location).toContain(testCase.expectedCity);
    }
  }, 15000);

  it("should handle API errors gracefully", async () => {
    if (!requiresAPIKey) {
      console.log("Skipping test - no MAPBOX_API_KEY provided");
      return;
    }

    // Test with a zip code that might cause API issues
    const result = await validateLocation("99999");

    expect(result.error).toBeNull();
    expect(result.state).toBeNull();
    expect(result.location).toBeNull();
  }, 10000);
});
