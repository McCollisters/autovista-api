/**
 * Clear All Modifier Sets Script
 *
 * This script deletes all modifier sets from the database.
 * Use with caution - this is irreversible!
 *
 * To run this script:
 * 1. Set your MongoDB connection string:
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/clear-modifier-sets.ts
 */

import "dotenv/config";
import mongoose from "mongoose";
import { getMigrationConfig, MigrationDatabase } from "../config/database";

async function clearModifierSets() {
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
    
    const destinationModifierSetsCollection = destinationDb.collection("modifiersets");
    console.log("✅ Connected to MongoDB");

    // Count existing modifier sets
    const modifierSetCount = await destinationModifierSetsCollection.countDocuments();
    console.log(`📦 Found ${modifierSetCount} modifier sets in destination database`);

    if (modifierSetCount === 0) {
      console.log("✅ No modifier sets to delete");
      await db.disconnect();
      return;
    }

    // Ask for confirmation (in a real script, you might want to add a prompt)
    console.log(`⚠️  WARNING: This will delete ALL ${modifierSetCount} modifier sets!`);
    console.log("   Make sure you have a backup or are ready to re-migrate them.");

    // Delete all modifier sets
    const deleteResult = await destinationModifierSetsCollection.deleteMany({});

    console.log(`✅ Successfully deleted ${deleteResult.deletedCount} modifier sets`);
    console.log("✅ Database is now ready for fresh modifier set migration");

  } catch (error) {
    console.error("❌ Script failed:", error);
    throw error;
  } finally {
    await db.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the script
clearModifierSets()
  .then(() => {
    console.log("\n✅ Clear modifier sets script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Script execution failed:", error);
    process.exit(1);
  });
