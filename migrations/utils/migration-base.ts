import { MigrationDatabase, getMigrationConfig } from "../config/database";

export interface MigrationResult {
  success: boolean;
  message: string;
  recordsAffected?: number;
  error?: string;
}

export abstract class MigrationBase {
  protected db: MigrationDatabase;
  protected startTime: Date;

  constructor() {
    this.db = new MigrationDatabase(getMigrationConfig());
    this.startTime = new Date();
  }

  abstract up(): Promise<MigrationResult>;
  abstract down(): Promise<MigrationResult>;

  async run(direction: "up" | "down" = "up"): Promise<MigrationResult> {
    try {
      console.log(`🚀 Starting migration: ${this.constructor.name}`);
      console.log(`📅 Started at: ${this.startTime.toISOString()}`);

      await this.db.connect();

      const result = direction === "up" ? await this.up() : await this.down();

      const endTime = new Date();
      const duration = endTime.getTime() - this.startTime.getTime();

      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`📊 Records affected: ${result.recordsAffected || 0}`);

      if (result.success) {
        console.log(
          `✅ Migration ${direction} completed successfully: ${result.message}`,
        );
      } else {
        console.log(`❌ Migration ${direction} failed: ${result.message}`);
        if (result.error) {
          console.error(`🔍 Error details: ${result.error}`);
        }
      }

      return result;
    } catch (error) {
      const errorResult: MigrationResult = {
        success: false,
        message: `Migration failed with exception: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.stack : String(error),
      };

      console.error(`💥 Migration exception:`, error);
      return errorResult;
    } finally {
      await this.db.disconnect();
    }
  }

  protected createSuccessResult(
    message: string,
    recordsAffected?: number,
  ): MigrationResult {
    return {
      success: true,
      message,
      recordsAffected,
    };
  }

  protected createErrorResult(
    message: string,
    error?: string,
  ): MigrationResult {
    return {
      success: false,
      message,
      error,
    };
  }

  protected getSourceConnection() {
    return this.db.getSourceConnection();
  }

  protected getDestinationConnection() {
    return this.db.getDestinationConnection();
  }

  // Legacy method for backward compatibility
  protected getConnection() {
    return this.db.getConnection();
  }

  protected getSourceDatabaseName(): string {
    return this.db.getSourceDatabaseName();
  }

  protected getDestinationDatabaseName(): string {
    return this.db.getDestinationDatabaseName();
  }

  // Legacy method for backward compatibility
  protected getDatabaseName(): string {
    return this.db.getDatabaseName();
  }
}

// Utility functions for common migration operations
export const MigrationUtils = {
  async batchProcess<T>(
    items: T[],
    processor: (item: T, index: number) => Promise<void>,
    batchSize: number = 100,
  ): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      for (const item of batch) {
        try {
          await processor(item, i);
          processed++;
        } catch (error) {
          errors++;
          console.error(`Error processing item at index ${i}:`, error);
        }
      }

      console.log(
        `Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`,
      );
    }

    return { processed, errors };
  },

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          console.log(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2; // Exponential backoff
        }
      }
    }

    throw lastError!;
  },
};
