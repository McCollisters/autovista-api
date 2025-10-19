import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { matchesExistingQuote } from "@/quote/services/matchesExistingQuote";
import {
  createMockVehicle,
  createMockQuote,
} from "@tests/utils/testDataFactory";

// Mock the Quote model
jest.mock("@/_global/models", () => ({
  Quote: {
    findOne: jest.fn(),
  },
}));

describe("matchesExistingQuote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return null when origin is not provided", async () => {
    const result = await matchesExistingQuote(
      "",
      "destination",
      "portal-id",
      [],
      0,
    );
    expect(result).toBeNull();
  });

  it("should return null when vehicles is not provided", async () => {
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      "portal-id",
      null as any,
      0,
    );
    expect(result).toBeNull();
  });

  it("should return null when vehicles is not an array", async () => {
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      "portal-id",
      {} as any,
      0,
    );
    expect(result).toBeNull();
  });

  it("should return null when no existing quote is found", async () => {
    const { Quote } = require("@/_global/models");
    Quote.findOne.mockResolvedValue(null);

    const vehicles = [createMockVehicle()];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      "portal-id",
      vehicles,
      0,
    );

    expect(result).toBeNull();
    expect(Quote.findOne).toHaveBeenCalledWith({
      "origin.userInput": "origin",
      "destination.userInput": "destination",
      portalId: "portal-id",
      createdAt: { $gte: expect.any(Date) },
    });
  });

  it("should return null when existing quote has different number of vehicles", async () => {
    const { Quote } = require("@/_global/models");
    const existingQuote = createMockQuote({
      vehicles: [createMockVehicle(), createMockVehicle()],
    });
    Quote.findOne.mockResolvedValue(existingQuote);

    const vehicles = [createMockVehicle()]; // Only 1 vehicle
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      "portal-id",
      vehicles,
      0,
    );

    expect(result).toBeNull();
  });

  it("should return null when vehicle makes don't match", async () => {
    const { Quote } = require("@/_global/models");
    const existingQuote = createMockQuote({
      vehicles: [createMockVehicle({ make: "Toyota" })],
    });
    Quote.findOne.mockResolvedValue(existingQuote);

    const vehicles = [createMockVehicle({ make: "Honda" })];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      "portal-id",
      vehicles,
      0,
    );

    expect(result).toBeNull();
  });

  it("should return null when vehicle models don't match", async () => {
    const { Quote } = require("@/_global/models");
    const existingQuote = createMockQuote({
      vehicles: [createMockVehicle({ make: "Toyota", model: "Camry" })],
    });
    Quote.findOne.mockResolvedValue(existingQuote);

    const vehicles = [createMockVehicle({ make: "Toyota", model: "Corolla" })];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      "portal-id",
      vehicles,
      0,
    );

    expect(result).toBeNull();
  });

  it("should return null when commission doesn't match", async () => {
    const { Quote } = require("@/_global/models");
    const existingQuote = createMockQuote({
      vehicles: [
        createMockVehicle({
          pricing: {
            modifiers: {
              commission: 100,
            },
          },
        }),
      ],
    });
    Quote.findOne.mockResolvedValue(existingQuote);

    const vehicles = [createMockVehicle()];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      "portal-id",
      vehicles,
      50,
    );

    expect(result).toBeNull();
  });

  it("should return existing quote when all conditions match", async () => {
    const { Quote } = require("@/_global/models");
    const existingQuote = createMockQuote({
      vehicles: [
        createMockVehicle({
          make: "Toyota",
          model: "Camry",
          pricing: {
            modifiers: {
              commission: 100,
            },
          },
        }),
      ],
    });
    Quote.findOne.mockResolvedValue(existingQuote);

    const vehicles = [
      createMockVehicle({
        make: "Toyota",
        model: "Camry",
      }),
    ];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      "portal-id",
      vehicles,
      100,
    );

    expect(result).toEqual(existingQuote);
  });

  it("should return existing quote when commission is not set in existing quote", async () => {
    const { Quote } = require("@/_global/models");
    const existingQuote = createMockQuote({
      vehicles: [
        createMockVehicle({
          make: "Toyota",
          model: "Camry",
          pricing: {
            modifiers: {
              commission: 0,
            },
          },
        }),
      ],
    });
    Quote.findOne.mockResolvedValue(existingQuote);

    const vehicles = [
      createMockVehicle({
        make: "Toyota",
        model: "Camry",
      }),
    ];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      "portal-id",
      vehicles,
      100,
    );

    expect(result).toEqual(existingQuote);
  });

  it("should handle database errors gracefully", async () => {
    const { Quote } = require("@/_global/models");
    Quote.findOne.mockRejectedValue(new Error("Database error"));

    const vehicles = [createMockVehicle()];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      "portal-id",
      vehicles,
      0,
    );

    expect(result).toBeNull();
  });

  it("should handle multiple vehicles correctly", async () => {
    const { Quote } = require("@/_global/models");
    const existingQuote = createMockQuote({
      vehicles: [
        createMockVehicle({ make: "Toyota", model: "Camry" }),
        createMockVehicle({ make: "Honda", model: "Civic" }),
      ],
    });
    Quote.findOne.mockResolvedValue(existingQuote);

    const vehicles = [
      createMockVehicle({ make: "Toyota", model: "Camry" }),
      createMockVehicle({ make: "Honda", model: "Civic" }),
    ];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      "portal-id",
      vehicles,
      0,
    );

    expect(result).toEqual(existingQuote);
  });

  it("should return null when incoming vehicles array has missing vehicles", async () => {
    const { Quote } = require("@/_global/models");
    const existingQuote = createMockQuote({
      vehicles: [
        createMockVehicle({ make: "Toyota", model: "Camry" }),
        createMockVehicle({ make: "Honda", model: "Civic" }),
      ],
    });
    Quote.findOne.mockResolvedValue(existingQuote);

    const vehicles = [
      createMockVehicle({ make: "Toyota", model: "Camry" }),
      // Missing second vehicle
    ];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      "portal-id",
      vehicles,
      0,
    );

    expect(result).toBeNull();
  });
});
