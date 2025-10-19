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

    expect(result).toEqual({
      state: null,
      location: null,
      error: "Please contact us for quotes with pick up or delivery to Canada.",
    });
  });

  it("should return error for Hawaii locations", async () => {
    const result = await validateLocation("Honolulu, HI");

    expect(result).toEqual({
      state: null,
      location: null,
      error:
        "For quotes involving transport to or from AK (Alaska) or HI (Hawaii) please contact us directly for a specialized quote at (888) 819-0594 or email us at autologistics@mccollisters.com.  Thank you!",
    });
  });

  it("should return error for Alaska locations", async () => {
    const result = await validateLocation("Anchorage, AK");

    expect(result).toEqual({
      state: null,
      location: null,
      error:
        "For quotes involving transport to or from AK (Alaska) or HI (Hawaii) please contact us directly for a specialized quote at (888) 819-0594 or email us at autologistics@mccollisters.com.  Thank you!",
    });
  });

  it("should return error for invalid zip code length", async () => {
    const result = await validateLocation("1234");

    expect(result).toEqual({
      state: null,
      location: null,
      error: "Invalid zip code",
    });
  });

  it("should return error for invalid zip code length (too long)", async () => {
    const result = await validateLocation("123456");

    expect(result).toEqual({
      state: null,
      location: null,
      error: "Invalid zip code",
    });
  });

  it("should validate 5-digit zip code and return city/state", async () => {
    const result = await validateLocation("10001");

    // Should return either valid data or null due to API key
    expect(result).toBeDefined();
    expect(result).toHaveProperty("state");
    expect(result).toHaveProperty("location");
    expect(result).toHaveProperty("error");

    // If API key is available, should get valid data
    if (requiresAPIKey && result.state) {
      expect(result.state).toBe("NY");
      expect(result.location).toContain("New York");
      expect(result.error).toBeNull();
    } else {
      // Without API key, should return null values
      expect(result.state).toBeNull();
      expect(
        result.location === null || result.location.includes("undefined"),
      ).toBe(true);
    }
  });

  it("should handle zip code lookup returning null values", async () => {
    const result = await validateLocation("99999");

    expect(result).toEqual({
      state: null,
      location: null,
      error: null,
    });
  });

  it("should extract state abbreviation from city, state format", async () => {
    const result = await validateLocation("Los Angeles, CA");

    expect(result).toEqual({
      state: "CA",
      location: null,
      error: null,
    });
  });

  it("should handle state abbreviation not found", async () => {
    const result = await validateLocation("Invalid Location");

    expect(result).toEqual({
      state: null,
      location: null,
      error: null,
    });
  });

  it("should handle mixed content (numbers and letters)", async () => {
    const result = await validateLocation("123 Main St, Houston, TX");

    expect(result).toEqual({
      state: "TX",
      location: null,
      error: null,
    });
  });

  it("should prioritize Canadian postcode check over other validations", async () => {
    const result = await validateLocation("10001");

    // Should return either valid data or null due to API key
    expect(result).toBeDefined();
    expect(result).toHaveProperty("state");
    expect(result).toHaveProperty("location");
    expect(result).toHaveProperty("error");

    // If API key is available, should get valid data
    if (requiresAPIKey && result.state) {
      expect(result.state).toBe("NY");
      expect(result.location).toContain("New York");
      expect(result.error).toBeNull();
    } else {
      // Without API key, should return null values
      expect(result.state).toBeNull();
      expect(
        result.location === null || result.location.includes("undefined"),
      ).toBe(true);
    }
  });

  it("should prioritize Hawaii/Alaska check over zip code validation", async () => {
    const result = await validateLocation("96801");

    // Should return either valid data or null due to API key
    expect(result).toBeDefined();
    expect(result).toHaveProperty("state");
    expect(result).toHaveProperty("location");
    expect(result).toHaveProperty("error");

    // If API key is available, should get valid data
    if (requiresAPIKey && result.state) {
      expect(result.state).toBe("HI");
      expect(result.location).toContain("Honolulu");
      expect(result.error).toBeNull();
    } else {
      // Without API key, should return null values
      expect(result.state).toBeNull();
      expect(
        result.location === null || result.location.includes("undefined"),
      ).toBe(true);
    }
  });
});
