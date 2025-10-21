import mongoose, { Connection } from "mongoose";

export interface MigrationConfig {
  sourceConnectionString: string;
  destinationConnectionString: string;
  sourceDatabaseName?: string;
  destinationDatabaseName?: string;
  timeout?: number;
}

export class MigrationDatabase {
  private sourceConnectionString: string;
  private destinationConnectionString: string;
  private sourceDatabaseName?: string;
  private destinationDatabaseName?: string;
  private timeout: number;
  private sourceConnection: Connection | null = null;
  private destinationConnection: Connection | null = null;

  constructor(config: MigrationConfig) {
    this.sourceConnectionString = config.sourceConnectionString;
    this.destinationConnectionString = config.destinationConnectionString;
    this.sourceDatabaseName = config.sourceDatabaseName;
    this.destinationDatabaseName = config.destinationDatabaseName;
    this.timeout = config.timeout || 30000;
  }

  async connect(): Promise<void> {
    try {
      // Connect to source database
      this.sourceConnection = await mongoose.createConnection(
        this.sourceConnectionString,
        {
          serverSelectionTimeoutMS: this.timeout,
          socketTimeoutMS: this.timeout,
          bufferCommands: false,
        },
      );

      // Wait for source connection to be ready
      await this.sourceConnection.asPromise();

      console.log(
        `✅ Connected to source MongoDB: ${this.getSourceDatabaseName()}`,
      );

      // Connect to destination database
      this.destinationConnection = await mongoose.createConnection(
        this.destinationConnectionString,
        {
          serverSelectionTimeoutMS: this.timeout,
          socketTimeoutMS: this.timeout,
          bufferCommands: false,
        },
      );

      // Wait for destination connection to be ready
      await this.destinationConnection.asPromise();

      console.log(
        `✅ Connected to destination MongoDB: ${this.getDestinationDatabaseName()}`,
      );
    } catch (error) {
      console.error("❌ Failed to connect to MongoDB:", error);
      await this.disconnect(); // Clean up any partial connections
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.sourceConnection) {
        await this.sourceConnection.close();
        console.log("✅ Disconnected from source MongoDB");
      }

      if (this.destinationConnection) {
        await this.destinationConnection.close();
        console.log("✅ Disconnected from destination MongoDB");
      }
    } catch (error) {
      console.error("❌ Error disconnecting from MongoDB:", error);
      throw error;
    }
  }

  getSourceConnection(): Connection {
    if (!this.sourceConnection) {
      throw new Error(
        "Source connection not established. Call connect() first.",
      );
    }
    return this.sourceConnection;
  }

  getDestinationConnection(): Connection {
    if (!this.destinationConnection) {
      throw new Error(
        "Destination connection not established. Call connect() first.",
      );
    }
    return this.destinationConnection;
  }

  // Legacy method for backward compatibility
  getConnection(): Connection {
    return this.getSourceConnection();
  }

  getSourceDatabaseName(): string {
    if (this.sourceDatabaseName) {
      return this.sourceDatabaseName;
    }

    // Extract database name from connection string
    const match = this.sourceConnectionString.match(/\/([^?]+)/);
    return match ? match[1] : "unknown";
  }

  getDestinationDatabaseName(): string {
    if (this.destinationDatabaseName) {
      return this.destinationDatabaseName;
    }

    // Extract database name from connection string
    const match = this.destinationConnectionString.match(/\/([^?]+)/);
    return match ? match[1] : "unknown";
  }

  // Legacy method for backward compatibility
  getDatabaseName(): string {
    return this.getSourceDatabaseName();
  }

  async isSourceConnected(): Promise<boolean> {
    return this.sourceConnection?.readyState === 1;
  }

  async isDestinationConnected(): Promise<boolean> {
    return this.destinationConnection?.readyState === 1;
  }

  async isConnected(): Promise<boolean> {
    return (
      (await this.isSourceConnected()) && (await this.isDestinationConnected())
    );
  }
}

// Environment-based configuration
export const getMigrationConfig = (): MigrationConfig => {
  const sourceConnectionString = process.env.MIGRATION_SOURCE_URI;
  const destinationConnectionString = process.env.MIGRATION_DEST_URI;

  if (!sourceConnectionString) {
    throw new Error(
      "Source MongoDB connection string not found. Please set MIGRATION_SOURCE_URI environment variable.",
    );
  }

  if (!destinationConnectionString) {
    throw new Error(
      "Destination MongoDB connection string not found. Please set MIGRATION_DEST_URI environment variable.",
    );
  }

  return {
    sourceConnectionString,
    destinationConnectionString,
    sourceDatabaseName: process.env.MIGRATION_SOURCE_DATABASE_NAME,
    destinationDatabaseName: process.env.MIGRATION_DESTINATION_DATABASE_NAME,
    timeout: parseInt(process.env.MIGRATION_TIMEOUT || "30000", 10),
  };
};
