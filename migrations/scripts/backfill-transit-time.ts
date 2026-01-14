import mongoose from "mongoose";
import { MigrationBase, MigrationResult } from "../utils/migration-base";

/**
 * Backfill Transit Time Migration Script
 *
 * This script backfills transitTime for quotes that have an empty transitTime array.
 * It uses the Settings.transitTimes lookup table to calculate transit time based on miles.
 *
 * To run this migration:
 * 1. Set your MongoDB connection string:
 *    export MONGODB_URI="mongodb://localhost:27017/destination-database"
 *    OR
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/backfill-transit-time.ts
 */

interface ITransitTime {
  minMiles: number;
  maxMiles: number;
  minDays: number;
  maxDays: number;
}

interface ISettings {
  transitTimes: ITransitTime[];
}

class BackfillTransitTimeMigration extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      // Get connection URI from environment variables
      const connectionUri =
        process.env.MONGODB_URI ||
        process.env.MIGRATION_DEST_URI ||
        process.env.MONGODB_CONNECTION_STRING;

      if (!connectionUri || connectionUri.includes("source-db-uri") || connectionUri.includes("destination-db-uri")) {
        throw new Error(
          "Please set MONGODB_URI or MIGRATION_DEST_URI environment variable with a valid MongoDB connection string"
        );
      }

      console.log("🔌 Connecting to MongoDB...");
      console.log(`   Connection: ${connectionUri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@")}`);
      
      await mongoose.connect(connectionUri);
      console.log("✅ Connected to MongoDB");

      // Import models
      const { Quote } = await import("../../src/_global/models");
      const { Settings } = await import("../../src/_global/models");

      // Get transit time lookup table from Settings
      console.log("📋 Fetching transit time lookup table from Settings...");
      const settings = await Settings.findOne().lean<ISettings>();
      
      if (!settings || !settings.transitTimes || settings.transitTimes.length === 0) {
        console.warn("⚠️  No transit time lookup table found in Settings. Cannot backfill transit time.");
        await mongoose.disconnect();
        return {
          success: false,
          message: "No transit time lookup table found in Settings",
          recordsAffected: 0,
        };
      }

      console.log(`✅ Found ${settings.transitTimes.length} transit time ranges`);

      // Function to calculate transit time from miles
      const calculateTransitTime = (miles: number): [number, number] | null => {
        if (!miles || miles <= 0) {
          return null;
        }

        // Find the matching range (miles >= minMiles && miles <= maxMiles)
        // Note: For the last range, we check miles >= minMiles (no upper bound check)
        for (let i = 0; i < settings.transitTimes.length; i++) {
          const range = settings.transitTimes[i];
          const isLastRange = i === settings.transitTimes.length - 1;
          
          if (isLastRange) {
            // Last range: check if miles >= minMiles (no upper bound)
            if (miles >= range.minMiles) {
              return [range.minDays, range.maxDays];
            }
          } else {
            // Regular range: check if miles is within bounds
            if (miles >= range.minMiles && miles <= range.maxMiles) {
              return [range.minDays, range.maxDays];
            }
          }
        }

        // Fallback: if no match found, use the first range for very small miles
        // or the last range for very large miles
        if (settings.transitTimes.length > 0) {
          const firstRange = settings.transitTimes[0];
          const lastRange = settings.transitTimes[settings.transitTimes.length - 1];
          
          if (miles < firstRange.minMiles) {
            return [firstRange.minDays, firstRange.maxDays];
          }
          if (miles > lastRange.maxMiles) {
            return [lastRange.minDays, lastRange.maxDays];
          }
        }

        return null;
      };

      // Find quotes with empty or missing transitTime
      console.log("🔍 Finding quotes with missing transit time...");
      const quotesToUpdate = await Quote.find({
        $or: [
          { transitTime: { $exists: false } },
          { transitTime: [] },
          { transitTime: { $size: 0 } },
          { transitTime: null },
        ],
        miles: { $exists: true, $gt: 0 },
      }).lean();

      console.log(`📊 Found ${quotesToUpdate.length} quotes to update`);

      if (quotesToUpdate.length === 0) {
        await mongoose.disconnect();
        return {
          success: true,
          message: "No quotes need transit time backfill",
          recordsAffected: 0,
        };
      }

      // Update quotes with calculated transit time
      let updatedCount = 0;
      let skippedCount = 0;

      for (const quote of quotesToUpdate) {
        const transitTime = calculateTransitTime(quote.miles);

        if (transitTime) {
          await Quote.updateOne(
            { _id: quote._id },
            { $set: { transitTime } }
          );
          updatedCount++;
        } else {
          console.warn(`⚠️  Could not calculate transit time for quote ${quote._id} with ${quote.miles} miles`);
          skippedCount++;
        }
      }

      console.log(`✅ Updated ${updatedCount} quotes`);
      if (skippedCount > 0) {
        console.log(`⚠️  Skipped ${skippedCount} quotes (could not calculate transit time)`);
      }

      await mongoose.disconnect();
      console.log("🔌 Disconnected from MongoDB");

      return {
        success: true,
        message: `Successfully backfilled transit time for ${updatedCount} quotes`,
        recordsAffected: updatedCount,
      };
    } catch (error) {
      console.error("❌ Script failed:", error);
      await mongoose.disconnect().catch(() => {});
      return {
        success: false,
        message: "Failed to backfill transit time",
        recordsAffected: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async down(): Promise<MigrationResult> {
    // This migration doesn't have a rollback - we don't want to remove transit time
    return {
      success: false,
      message: "Rollback not supported for transit time backfill",
      recordsAffected: 0,
    };
  }
}

// Run the migration
const migration = new BackfillTransitTimeMigration();
migration.run("up").catch((error) => {
  console.error("💥 Script execution failed:", error);
  process.exit(1);
});
