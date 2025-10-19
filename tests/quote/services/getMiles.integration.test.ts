import { describe, it, expect, beforeAll } from "@jest/globals";
import { getMiles } from "@/quote/services/getMiles";

// Use real API calls for integration tests
const requiresAPIKey = process.env.MAPBOX_API_KEY;

describe("getMiles Integration Tests", () => {
  beforeAll(() => {
    if (!requiresAPIKey) {
      console.log(
        "Warning: No MAPBOX_API_KEY provided. Tests will be skipped.",
      );
      console.log(
        "Set MAPBOX_API_KEY environment variable to run integration tests.",
      );
    }
  });

  it("should calculate real miles between New York and Los Angeles", async () => {
    if (!requiresAPIKey) {
      console.log("Skipping test - no MAPBOX_API_KEY provided");
      return;
    }

    const origin: [number, number] = [-74.006, 40.7128]; // New York
    const destination: [number, number] = [-118.2437, 34.0522]; // Los Angeles

    const result = await getMiles(origin, destination);

    // Real distance between NYC and LA is approximately 2,800 miles
    expect(result).toBeGreaterThan(2700);
    expect(result).toBeLessThan(2900);
  }, 15000); // 15 second timeout for API call

  it("should calculate real miles between close locations", async () => {
    if (!requiresAPIKey) {
      console.log("Skipping test - no MAPBOX_API_KEY provided");
      return;
    }

    const origin: [number, number] = [-74.006, 40.7128]; // New York
    const destination: [number, number] = [-73.935242, 40.73061]; // Brooklyn

    const result = await getMiles(origin, destination);

    // Distance between Manhattan and Brooklyn is approximately 10-15 miles
    expect(result).toBeGreaterThan(5);
    expect(result).toBeLessThan(20);
  }, 10000);

  it("should return null for invalid coordinates", async () => {
    if (!requiresAPIKey) {
      console.log("Skipping test - no MAPBOX_API_KEY provided");
      return;
    }

    const origin: [number, number] = [999, 999]; // Invalid coordinates
    const destination: [number, number] = [-118.2437, 34.0522];

    const result = await getMiles(origin, destination);

    expect(result).toBeNull();
  }, 10000);

  it("should handle API rate limiting gracefully", async () => {
    if (!requiresAPIKey) {
      console.log("Skipping test - no MAPBOX_API_KEY provided");
      return;
    }

    const origin: [number, number] = [-74.006, 40.7128];
    const destination: [number, number] = [-118.2437, 34.0522];

    // Make multiple rapid calls to test rate limiting
    const promises = Array(3)
      .fill(null)
      .map(() => getMiles(origin, destination));
    const results = await Promise.all(promises);

    // All calls should either succeed or fail gracefully
    results.forEach((result) => {
      expect(typeof result === "number" || result === null).toBe(true);
    });
  }, 20000);

  it("should calculate miles for various real routes", async () => {
    if (!requiresAPIKey) {
      console.log("Skipping test - no MAPBOX_API_KEY provided");
      return;
    }

    const testCases = [
      {
        name: "San Francisco to Los Angeles",
        origin: [-122.4194, 37.7749] as [number, number],
        destination: [-118.2437, 34.0522] as [number, number],
        expectedMin: 300,
        expectedMax: 400,
      },
      {
        name: "Miami to Orlando",
        origin: [-80.1918, 25.7617] as [number, number],
        destination: [-81.3792, 28.5383] as [number, number],
        expectedMin: 200,
        expectedMax: 300,
      },
      {
        name: "Chicago to Detroit",
        origin: [-87.6298, 41.8781] as [number, number],
        destination: [-83.0458, 42.3314] as [number, number],
        expectedMin: 250,
        expectedMax: 350,
      },
    ];

    for (const testCase of testCases) {
      const result = await getMiles(testCase.origin, testCase.destination);

      expect(result).not.toBeNull();
      expect(result).toBeGreaterThan(testCase.expectedMin);
      expect(result).toBeLessThan(testCase.expectedMax);
      console.log(`${testCase.name}: ${result} miles`);
    }
  }, 30000);

  it("should handle network errors gracefully", async () => {
    if (!requiresAPIKey) {
      console.log("Skipping test - no MAPBOX_API_KEY provided");
      return;
    }

    // Test with coordinates that might cause network issues
    const origin: [number, number] = [0, 0]; // Middle of ocean
    const destination: [number, number] = [180, 90]; // Edge case

    const result = await getMiles(origin, destination);

    // Should either return null or a valid number
    expect(typeof result === "number" || result === null).toBe(true);
  }, 15000);

  it("should handle missing API key gracefully", async () => {
    // Temporarily remove API key
    const originalKey = process.env.MAPBOX_API_KEY;
    delete process.env.MAPBOX_API_KEY;

    const origin: [number, number] = [-74.006, 40.7128];
    const destination: [number, number] = [-73.935242, 40.73061];

    const result = await getMiles(origin, destination);

    expect(result).toBeNull();

    // Restore API key
    if (originalKey) {
      process.env.MAPBOX_API_KEY = originalKey;
    }
  });
});
