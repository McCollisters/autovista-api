import {
  MigrationBase,
  MigrationResult,
} from "../utils/migration-base";
import { Types } from "mongoose";

/**
 * Settings Migration Script
 *
 * This migration copies the Settings collection from the source database to the destination database.
 * Key data migrated:
 * - transitTimes: Lookup table for calculating transit time based on miles
 * - holidays: List of holidays
 * - quoteExpirationDays: Number of days before quotes expire
 * - serviceLevels: Service level configurations
 *
 * IMPORTANT: This migration overwrites any existing Settings document in the destination database.
 *
 * To run this migration:
 * 1. Set your MongoDB connection strings:
 *    export MIGRATION_SOURCE_URI="mongodb://localhost:27017/source-database"
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/migrate-settings.ts
 */

interface OldSettings {
  _id: any;
  transitTimes?: Array<{
    minMiles: number;
    maxMiles: number;
    minDays: number;
    maxDays: number;
    _id?: any;
  }>;
  holidays?: Date[];
  quoteExpirationDays?: number;
  serviceLevels?: Array<{
    name: string;
    value: string;
    markup: number;
    _id?: any;
  }>;
  updatedAt?: Date;
  createdAt?: Date;
}

class MigrateSettings extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log("🔍 Fetching Settings from source database...");

      // Get source connection (prod database) for reading
      console.log("📡 Getting source connection...");
      const sourceConnection = this.getSourceConnection();
      const sourceDb = sourceConnection.db;

      // Get destination connection (dev database) for writing
      console.log("📡 Getting destination connection...");
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!sourceDb || !destinationDb) {
        throw new Error("Database connections not available");
      }

      // Get Settings from source database
      const sourceSettings = await sourceDb
        .collection("settings")
        .findOne({});

      if (!sourceSettings) {
        console.log("⚠️  No Settings document found in source database");
        return {
          success: false,
          message: "No Settings document found in source database",
          recordsAffected: 0,
        };
      }

      const oldSettings = sourceSettings as OldSettings;
      console.log("✅ Found Settings document in source database");

      // Transform to new format
      const newSettings: any = {
        transitTimes: oldSettings.transitTimes
          ? oldSettings.transitTimes.map((tt) => ({
              minMiles: tt.minMiles || 0,
              maxMiles: tt.maxMiles || 0,
              minDays: tt.minDays || 0,
              maxDays: tt.maxDays || 0,
            }))
          : [],
        holidays: oldSettings.holidays || [],
        quoteExpirationDays: oldSettings.quoteExpirationDays || 10,
        serviceLevels: oldSettings.serviceLevels
          ? oldSettings.serviceLevels.map((sl) => ({
              name: sl.name || "",
              value: sl.value || "",
              markup: sl.markup || 0,
            }))
          : [],
        updatedAt: oldSettings.updatedAt || new Date(),
      };

      console.log(`📊 Transit Times: ${newSettings.transitTimes.length} ranges`);
      console.log(`📊 Holidays: ${newSettings.holidays.length} holidays`);
      console.log(`📊 Service Levels: ${newSettings.serviceLevels.length} levels`);

      // Check if Settings already exists in destination
      const existingSettings = await destinationDb
        .collection("settings")
        .findOne({});

      if (existingSettings) {
        console.log("⚠️  Settings document already exists in destination database");
        console.log("🔄 Updating existing Settings document...");

        await destinationDb.collection("settings").updateOne(
          { _id: existingSettings._id },
          {
            $set: {
              transitTimes: newSettings.transitTimes,
              holidays: newSettings.holidays,
              quoteExpirationDays: newSettings.quoteExpirationDays,
              serviceLevels: newSettings.serviceLevels,
              updatedAt: new Date(),
            },
          }
        );

        console.log("✅ Updated Settings document in destination database");
      } else {
        console.log("➕ Creating new Settings document in destination database...");

        await destinationDb.collection("settings").insertOne(newSettings);

        console.log("✅ Created Settings document in destination database");
      }

      return {
        success: true,
        message: "Successfully migrated Settings",
        recordsAffected: 1,
      };
    } catch (error) {
      console.error("❌ Migration failed:", error);
      return {
        success: false,
        message: "Failed to migrate Settings",
        recordsAffected: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async down(): Promise<MigrationResult> {
    // Rollback: Delete Settings from destination
    try {
      console.log("🔄 Rolling back Settings migration...");

      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!destinationDb) {
        throw new Error("Destination database connection not available");
      }

      const result = await destinationDb.collection("settings").deleteMany({});

      console.log(`✅ Deleted ${result.deletedCount} Settings document(s)`);

      return {
        success: true,
        message: `Rolled back Settings migration (deleted ${result.deletedCount} document(s))`,
        recordsAffected: result.deletedCount || 0,
      };
    } catch (error) {
      console.error("❌ Rollback failed:", error);
      return {
        success: false,
        message: "Failed to rollback Settings migration",
        recordsAffected: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// Run the migration
const migration = new MigrateSettings();
migration.run("up").catch((error) => {
  console.error("💥 Script execution failed:", error);
  process.exit(1);
});
