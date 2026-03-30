import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getTMSBaseRate } from "@/quote/integrations/getTMSBaseRate";

describe("getTMSBaseRate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns quote when provider response is successful", async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            price: 1234,
          },
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const result = await getTMSBaseRate(
      { pricingClass: "sedan", isInoperable: false },
      "Dallas, TX",
      "Austin, TX",
    );

    expect(result).toEqual({ quote: 1234, vehicleDetails: {} });
  });

  it("throws actionable error for no-route-available quote failures", async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            meta: { status: "fail" },
            data: {
              message: "Pickup or delivery location is not accessible by road.",
              details: {
                reason:
                  "The routing engine could not find a drivable path between the provided locations.",
              },
              type: "NO_ROUTE_AVAILABLE",
            },
          }),
      } as Response;
    }) as unknown as typeof fetch;

    await expect(
      getTMSBaseRate(
        { pricingClass: "sedan", isInoperable: false },
        "Honolulu, HI",
        "Anchorage, AK",
      ),
    ).rejects.toThrow(
      "Unable to generate an automatic quote from Honolulu, HI to Anchorage, AK because no drivable route was found between the locations. Verify the pickup and delivery locations (including ZIP/state) or quote this shipment manually for special routing.",
    );
  });

  it("uses provider message for non-routing API errors", async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            data: {
              message: "Invalid vehicle type.",
              type: "VALIDATION_ERROR",
            },
          }),
      } as Response;
    }) as unknown as typeof fetch;

    await expect(
      getTMSBaseRate(
        { pricingClass: "invalid", isInoperable: false },
        "Dallas, TX",
        "Austin, TX",
      ),
    ).rejects.toThrow("HTTP error! status: 400 - Invalid vehicle type.");
  });
});
