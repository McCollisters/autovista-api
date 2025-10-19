import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "@jest/globals";
import { matchesExistingQuote } from "@/quote/services/matchesExistingQuote";
import {
  createMockVehicle,
  createMockQuote,
} from "../../utils/testDataFactory";
import { Quote } from "@/_global/models";
import mongoose from "mongoose";

// Use a consistent portalId for testing
const TEST_PORTAL_ID = "507f1f77bcf86cd799439011";

describe("matchesExistingQuote Integration Tests", () => {
  beforeAll(async () => {
    if (!process.env.MONGODB_TEST_URI) {
      console.log(
        "Warning: No MONGODB_TEST_URI provided. Tests will be skipped.",
      );
      console.log(
        "Set MONGODB_TEST_URI environment variable to run integration tests.",
      );
    }

    if (process.env.MONGODB_TEST_URI) {
      await mongoose.connect(process.env.MONGODB_TEST_URI as string);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    if (process.env.MONGODB_TEST_URI) {
      // Clear the quotes collection before each test
      await Quote.deleteMany({});
    }
  });

  afterEach(async () => {
    if (process.env.MONGODB_TEST_URI) {
      // Clean up after each test
      await Quote.deleteMany({});
    }
  });

  it("should return null when origin is not provided", async () => {
    if (!process.env.MONGODB_TEST_URI) {
      return;
    }

    const result = await matchesExistingQuote(
      "",
      "destination",
      TEST_PORTAL_ID,
      [],
      0,
    );
    expect(result).toBeNull();
  });

  it("should return null when vehicles is not provided", async () => {
    if (!process.env.MONGODB_TEST_URI) {
      console.log("Skipping test - no MONGODB_TEST_URI provided");
      return;
    }

    const result = await matchesExistingQuote(
      "origin",
      "destination",
      TEST_PORTAL_ID,
      null as any,
      0,
    );
    expect(result).toBeNull();
  });

  it("should return null when vehicles is not an array", async () => {
    if (!process.env.MONGODB_TEST_URI) {
      console.log("Skipping test - no MONGODB_TEST_URI provided");
      return;
    }

    const result = await matchesExistingQuote(
      "origin",
      "destination",
      TEST_PORTAL_ID,
      {} as any,
      0,
    );
    expect(result).toBeNull();
  });

  it("should return null when no existing quote is found", async () => {
    if (!process.env.MONGODB_TEST_URI) {
      console.log("Skipping test - no MONGODB_TEST_URI provided");
      return;
    }

    const vehicles = [createMockVehicle()];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      TEST_PORTAL_ID,
      vehicles,
      0,
    );

    expect(result).toBeNull();
  });

  it("should return null when existing quote has different number of vehicles", async () => {
    if (!process.env.MONGODB_TEST_URI) {
      console.log("Skipping test - no MONGODB_TEST_URI provided");
      return;
    }

    // Create an existing quote with 2 vehicles
    const existingQuote = new Quote(
      createMockQuote({
        portalId: TEST_PORTAL_ID,
        origin: { userInput: "origin" },
        destination: { userInput: "destination" },
        vehicles: [createMockVehicle(), createMockVehicle()],
        createdAt: new Date(),
      }),
    );
    await existingQuote.save();

    // Search for quote with 1 vehicle
    const vehicles = [createMockVehicle()];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      TEST_PORTAL_ID,
      vehicles,
      0,
    );

    expect(result).toBeNull();
  });

  it("should return null when vehicle makes don't match", async () => {
    if (!process.env.MONGODB_TEST_URI) {
      console.log("Skipping test - no MONGODB_TEST_URI provided");
      return;
    }

    // Create an existing quote with Toyota
    const existingQuote = new Quote(
      createMockQuote({
        portalId: TEST_PORTAL_ID,
        origin: { userInput: "origin" },
        destination: { userInput: "destination" },
        vehicles: [createMockVehicle({ make: "Toyota" })],
        createdAt: new Date(),
      }),
    );
    await existingQuote.save();

    // Search for quote with Honda
    const vehicles = [createMockVehicle({ make: "Honda" })];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      TEST_PORTAL_ID,
      vehicles,
      0,
    );

    expect(result).toBeNull();
  });

  it("should return null when vehicle models don't match", async () => {
    if (!process.env.MONGODB_TEST_URI) {
      console.log("Skipping test - no MONGODB_TEST_URI provided");
      return;
    }

    // Create an existing quote with Camry
    const existingQuote = new Quote(
      createMockQuote({
        portalId: TEST_PORTAL_ID,
        origin: { userInput: "origin" },
        destination: { userInput: "destination" },
        vehicles: [createMockVehicle({ make: "Toyota", model: "Camry" })],
        createdAt: new Date(),
      }),
    );
    await existingQuote.save();

    // Search for quote with Corolla
    const vehicles = [createMockVehicle({ make: "Toyota", model: "Corolla" })];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      TEST_PORTAL_ID,
      vehicles,
      0,
    );

    expect(result).toBeNull();
  });

  it("should return null when commission doesn't match", async () => {
    if (!process.env.MONGODB_TEST_URI) {
      console.log("Skipping test - no MONGODB_TEST_URI provided");
      return;
    }

    // Create an existing quote with commission 100
    const existingQuote = new Quote(
      createMockQuote({
        portalId: TEST_PORTAL_ID,
        origin: { userInput: "origin" },
        destination: { userInput: "destination" },
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
        createdAt: new Date(),
      }),
    );
    await existingQuote.save();

    // Search for quote with commission 50
    const vehicles = [createMockVehicle({ make: "Toyota", model: "Camry" })];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      TEST_PORTAL_ID,
      vehicles,
      50,
    );

    expect(result).toBeNull();
  });

  it("should return existing quote when all conditions match", async () => {
    if (!process.env.MONGODB_TEST_URI) {
      console.log("Skipping test - no MONGODB_TEST_URI provided");
      return;
    }

    // Create an existing quote
    const existingQuote = new Quote(
      createMockQuote({
        portalId: TEST_PORTAL_ID,
        origin: { userInput: "origin" },
        destination: { userInput: "destination" },
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
        createdAt: new Date(),
      }),
    );
    await existingQuote.save();

    // Search for matching quote
    const vehicles = [
      createMockVehicle({
        make: "Toyota",
        model: "Camry",
      }),
    ];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      TEST_PORTAL_ID,
      vehicles,
      100,
    );

    expect(result).not.toBeNull();
    expect(result!._id.toString()).toBe(existingQuote._id.toString());
  });

  it("should return existing quote when commission is not set in existing quote", async () => {
    if (!process.env.MONGODB_TEST_URI) {
      console.log("Skipping test - no MONGODB_TEST_URI provided");
      return;
    }

    // Create an existing quote without commission
    const existingQuote = new Quote(
      createMockQuote({
        portalId: TEST_PORTAL_ID,
        origin: { userInput: "origin" },
        destination: { userInput: "destination" },
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
        createdAt: new Date(),
      }),
    );
    await existingQuote.save();

    // Search for matching quote
    const vehicles = [
      createMockVehicle({
        make: "Toyota",
        model: "Camry",
      }),
    ];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      TEST_PORTAL_ID,
      vehicles,
      100,
    );

    expect(result).not.toBeNull();
    expect(result!._id.toString()).toBe(existingQuote._id.toString());
  });

  it("should handle multiple vehicles correctly", async () => {
    if (!process.env.MONGODB_TEST_URI) {
      console.log("Skipping test - no MONGODB_TEST_URI provided");
      return;
    }

    // Create an existing quote with multiple vehicles
    const existingQuote = new Quote(
      createMockQuote({
        portalId: TEST_PORTAL_ID,
        origin: { userInput: "origin" },
        destination: { userInput: "destination" },
        vehicles: [
          createMockVehicle({ make: "Toyota", model: "Camry" }),
          createMockVehicle({ make: "Honda", model: "Civic" }),
        ],
        createdAt: new Date(),
      }),
    );
    await existingQuote.save();

    // Search for matching quote
    const vehicles = [
      createMockVehicle({ make: "Toyota", model: "Camry" }),
      createMockVehicle({ make: "Honda", model: "Civic" }),
    ];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      TEST_PORTAL_ID,
      vehicles,
      0,
    );

    expect(result).not.toBeNull();
    expect(result!._id.toString()).toBe(existingQuote._id.toString());
  });

  it("should return null when incoming vehicles array has missing vehicles", async () => {
    if (!process.env.MONGODB_TEST_URI) {
      console.log("Skipping test - no MONGODB_TEST_URI provided");
      return;
    }

    // Create an existing quote with 2 vehicles
    const existingQuote = new Quote(
      createMockQuote({
        portalId: TEST_PORTAL_ID,
        origin: { userInput: "origin" },
        destination: { userInput: "destination" },
        vehicles: [
          createMockVehicle({ make: "Toyota", model: "Camry" }),
          createMockVehicle({ make: "Honda", model: "Civic" }),
        ],
        createdAt: new Date(),
      }),
    );
    await existingQuote.save();

    // Search with only 1 vehicle
    const vehicles = [createMockVehicle({ make: "Toyota", model: "Camry" })];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      TEST_PORTAL_ID,
      vehicles,
      0,
    );

    expect(result).toBeNull();
  });

  it("should only return quotes from the last 30 days", async () => {
    if (!process.env.MONGODB_TEST_URI) {
      console.log("Skipping test - no MONGODB_TEST_URI provided");
      return;
    }

    // Create an old quote (35 days ago)
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 35);

    const oldQuote = new Quote(
      createMockQuote({
        portalId: TEST_PORTAL_ID,
        origin: { userInput: "origin" },
        destination: { userInput: "destination" },
        vehicles: [createMockVehicle({ make: "Toyota", model: "Camry" })],
        createdAt: oldDate,
      }),
    );
    await oldQuote.save();

    // Search for matching quote
    const vehicles = [createMockVehicle({ make: "Toyota", model: "Camry" })];
    const result = await matchesExistingQuote(
      "origin",
      "destination",
      TEST_PORTAL_ID,
      vehicles,
      0,
    );

    expect(result).toBeNull();
  });
});
