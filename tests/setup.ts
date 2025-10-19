import { config } from "dotenv";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// Load environment variables from .env file
config({ path: ".env", quiet: true });

let mongoServer: MongoMemoryServer;

// Setup before all tests
beforeAll(async () => {
  // Use test database URI from environment if available, otherwise use in-memory MongoDB
  const testDbUri = process.env.MONGODB_TEST_URI;

  if (testDbUri) {
    // Connect to the test database
    await mongoose.connect(testDbUri);
  } else {
    // Start in-memory MongoDB instance as fallback
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  }
});

// Clean up before each test suite
beforeEach(async () => {
  // Clear only Quote and Order collections before each test suite starts
  // Keep Portal and ModifierSet collections as they're needed for tests
  const collections = mongoose.connection.collections;
  const collectionsToClean = [
    "quotes",
    "orders",
    "users",
    "reports",
    "surveys",
    "surveyresponses",
  ];

  for (const collectionName of collectionsToClean) {
    const collection = collections[collectionName];
    if (collection) {
      try {
        await collection.deleteMany({});
      } catch (error) {
        console.warn(`Failed to clear collection ${collectionName}:`, error);
      }
    }
  }
});

// Cleanup after all tests
afterAll(async () => {
  // Close database connection
  await mongoose.connection.close();

  // Stop the in-memory MongoDB instance if it was created
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Clean up after each test
afterEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    try {
      await collection.deleteMany({});
    } catch (error) {
      console.warn(`Failed to clear collection ${key}:`, error);
    }
  }

  // Clear any cached models to prevent stale data
  // Note: We don't clear models here as it causes schema registration issues
  // The models will be cleared when the connection is closed
});

// Global test utilities
declare global {
  var testUtils: {
    createTestData: (model: any, data: any) => Promise<any>;
    cleanCollections: (collections: string[]) => Promise<void>;
  };
}

global.testUtils = {
  // Helper to create test data
  createTestData: async (model: any, data: any) => {
    return await model.create(data);
  },

  // Helper to clean specific collections
  cleanCollections: async (collections: string[]) => {
    for (const collectionName of collections) {
      const collection = mongoose.connection.collections[collectionName];
      if (collection) {
        await collection.deleteMany({});
      }
    }
  },
};
