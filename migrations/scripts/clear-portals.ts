/**
 * Clear All Portals Script
 *
 * This script deletes all portals from the database.
 * Use with caution - this is irreversible!
 *
 * To run this script:
 * 1. Set your MongoDB connection string:
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/clear-portals.ts
 */

import "dotenv/config";
import mongoose from "mongoose";
import { getMigrationConfig, MigrationDatabase } from "../config/database";

async function clearPortals() {
  const db = new MigrationDatabase(getMigrationConfig());
  
  try {
    console.log("🔌 Connecting to MongoDB...");
    await db.connect();
    
    // Use destination database (where we're migrating TO)
    const destinationConnection = db.getDestinationConnection();
    const destinationDb = destinationConnection.db;
    
    if (!destinationDb) {
      throw new Error("Destination database connection not available");
    }
    
    const destinationPortalsCollection = destinationDb.collection("portals");
    console.log("✅ Connected to MongoDB");

    // Count existing portals
    const portalCount = await destinationPortalsCollection.countDocuments();
    console.log(`📦 Found ${portalCount} portals in destination database`);

    if (portalCount === 0) {
      console.log("✅ No portals to delete");
      await db.disconnect();
      return;
    }

    // Ask for confirmation (in a real script, you might want to add a prompt)
    console.log(`⚠️  WARNING: This will delete ALL ${portalCount} portals!`);
    console.log("   Make sure you have a backup or are ready to re-migrate them.");

    // Delete all portals
    const deleteResult = await destinationPortalsCollection.deleteMany({});

    console.log(`✅ Successfully deleted ${deleteResult.deletedCount} portals`);
    console.log("✅ Database is now ready for fresh portal migration");

  } catch (error) {
    console.error("❌ Script failed:", error);
    throw error;
  } finally {
    await db.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the script
clearPortals()
  .then(() => {
    console.log("\n✅ Clear portals script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Script execution failed:", error);
    process.exit(1);
  });
