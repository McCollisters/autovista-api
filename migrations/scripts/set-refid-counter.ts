import "dotenv/config";
import mongoose from "mongoose";

/**
 * Set refId Counter Script
 * 
 * This script sets the mongoose-sequence counter for quote refId to start at 300000.
 * This ensures new quotes will have refId starting from 300000.
 * 
 * To run this script:
 * 1. Set your MongoDB connection string:
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/database"
 *    (or use MONGODB_URI, MONGODB_DEV_URI, etc.)
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/set-refid-counter.ts
 */

async function setRefIdCounter() {
  // Get connection string from environment (try multiple possible env vars)
  const connectionString = 
    process.env.MIGRATION_DEST_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGODB_DEV_URI ||
    process.env.MONGODB_PROD_URI;

  if (!connectionString) {
    throw new Error(
      "MongoDB connection string not found. Please set MIGRATION_DEST_URI, MONGODB_URI, MONGODB_DEV_URI, or MONGODB_PROD_URI environment variable."
    );
  }

  // Check if connection string is a placeholder
  if (connectionString.includes("destination-db-uri") || 
      connectionString.includes("source-db-uri") ||
      connectionString === "mongodb://destination-db-uri" ||
      connectionString === "mongodb://source-db-uri") {
    throw new Error(
      `Invalid connection string: "${connectionString}". This appears to be a placeholder.\n` +
      `Please set a valid MongoDB connection string using one of these environment variables:\n` +
      `  - MIGRATION_DEST_URI\n` +
      `  - MONGODB_URI\n` +
      `  - MONGODB_DEV_URI\n` +
      `  - MONGODB_PROD_URI\n` +
      `Example: export MIGRATION_DEST_URI="mongodb://localhost:27017/your-database-name"`
    );
  }

  // Mask password in connection string for logging
  const maskedConnectionString = connectionString.replace(/:([^:@]+)@/, ":****@");
  console.log(`🔌 Connecting to MongoDB...`);
  console.log(`   Connection: ${maskedConnectionString}`);
  
  try {
    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not available");
    }

    // mongoose-sequence stores counters in a collection
    const counterCollection = db.collection("counters");
    
    // Find the highest existing refId in quotes collection
    const quotesCollection = db.collection("quotes");
    const maxRefIdDoc = await quotesCollection
      .findOne({ refId: { $exists: true, $ne: null } }, { sort: { refId: -1 } });
    
    const maxRefId = maxRefIdDoc?.refId || 0;
    const targetStartSeq = 300000;
    
    // Determine what the counter should be set to
    // If maxRefId is already >= 300000, use maxRefId + 1, otherwise use 300000
    const newCounterValue = Math.max(maxRefId + 1, targetStartSeq);
    
    console.log(`📊 Current max refId: ${maxRefId}`);
    console.log(`🎯 Target start sequence: ${targetStartSeq}`);
    console.log(`🔢 Setting counter to: ${newCounterValue}`);
    
    // mongoose-sequence uses format: "{modelName}_{fieldName}"
    // Check what counters exist first
    const existingCounters = await counterCollection.find({}).toArray();
    console.log(`📋 Found ${existingCounters.length} existing counters:`, existingCounters.map(c => `${c._id}: ${c.seq}`));
    
    // Try different possible counter ID formats (most common first)
    // Model name is "Quote", so "Quote_refId" is most likely
    // Also check for ObjectId-based counters (old format)
    const possibleCounterIds = [
      "Quote_refId",   // capitalized model name (most likely)
      "quotes_refId",  // lowercase model name
      "quote_refId",   // singular
      "Quote.refId",   // capitalized with dot
      "quotes.refId"   // dot notation
    ];
    
    // Check for ObjectId-based counters (old format) - these might be using model _id
    // These could be interfering with the correct counter
    const objectIdCounters = existingCounters.filter(c => {
      const idStr = typeof c._id === 'object' ? c._id.toString() : String(c._id);
      return /^[0-9a-f]{24}$/i.test(idStr);
    });
    
    if (objectIdCounters.length > 0) {
      console.log(`\n⚠️  Found ${objectIdCounters.length} ObjectId-based counter(s) that might be interfering:`);
      for (const oldCounter of objectIdCounters) {
        const oldId = typeof oldCounter._id === 'object' ? oldCounter._id.toString() : String(oldCounter._id);
        console.log(`   - ${oldId}: ${oldCounter.seq}`);
        
        // If this old counter has a value >= 300000, update it to match Quote_refId
        // Otherwise, we might want to delete it or set it very high to avoid conflicts
        if (oldCounter.seq < 300000) {
          console.log(`   ⚠️  Old counter ${oldId} has value ${oldCounter.seq} < 300000 - this might be causing refId issues!`);
          console.log(`   💡 Consider deleting this counter or updating it to match Quote_refId`);
        }
      }
    }
    
    let counterUpdated = false;
    let usedCounterId = null;
    
    // First, try to find existing counter
    for (const counterId of possibleCounterIds) {
      const existing = await counterCollection.findOne({ _id: counterId });
      if (existing) {
        // Check if counter needs updating
        if (existing.seq < newCounterValue) {
          const result = await counterCollection.updateOne(
            { _id: counterId },
            { $set: { seq: newCounterValue } }
          );
          if (result.modifiedCount > 0 || result.matchedCount > 0) {
            console.log(`✅ Updated existing counter ${counterId} from ${existing.seq} to ${newCounterValue}`);
            counterUpdated = true;
            usedCounterId = counterId;
            break;
          }
        } else {
          // Counter already at or above target value - this is success!
          console.log(`✅ Counter ${counterId} already set to ${existing.seq} (target: ${newCounterValue})`);
          counterUpdated = true;
          usedCounterId = counterId;
          break;
        }
      }
    }
    
    // If no existing counter found, create one
    // Use "Quote_refId" since model name is "Quote"
    if (!counterUpdated) {
      const defaultCounterId = "Quote_refId";
      const result = await counterCollection.updateOne(
        { _id: defaultCounterId },
        { 
          $set: { seq: newCounterValue },
          $setOnInsert: { _id: defaultCounterId }
        },
        { upsert: true }
      );
      if (result.upsertedCount > 0 || result.modifiedCount > 0) {
        console.log(`✅ Created/updated counter ${defaultCounterId} to ${newCounterValue}`);
        counterUpdated = true;
        usedCounterId = defaultCounterId;
      } else {
        // Check if counter already exists with correct value
        const existing = await counterCollection.findOne({ _id: defaultCounterId });
        if (existing && existing.seq >= newCounterValue) {
          console.log(`✅ Counter ${defaultCounterId} already exists with value ${existing.seq}`);
          counterUpdated = true;
          usedCounterId = defaultCounterId;
        }
      }
    }

    if (!counterUpdated) {
      throw new Error("Failed to update or create counter");
    }

    console.log(`\n✅ Successfully set refId counter to ${newCounterValue}`);
    console.log(`   Counter ID: ${usedCounterId}`);
    console.log(`   Target was: ${targetStartSeq}`);
    console.log(`   Max existing refId was: ${maxRefId}`);
    
    // Update old ObjectId-based counters to prevent them from being used
    // These might be interfering with the correct counter
    if (objectIdCounters.length > 0) {
      console.log(`\n🔄 Updating old ObjectId-based counters to prevent conflicts...`);
      for (const oldCounter of objectIdCounters) {
        const oldId = typeof oldCounter._id === 'object' ? oldCounter._id.toString() : String(oldCounter._id);
        if (oldCounter.seq < newCounterValue) {
          // Update old counter to match the new counter value to prevent it from being used
          await counterCollection.updateOne(
            { _id: oldId },
            { $set: { seq: newCounterValue } }
          );
          console.log(`   ✅ Updated old counter ${oldId} from ${oldCounter.seq} to ${newCounterValue}`);
        } else {
          console.log(`   ℹ️  Old counter ${oldId} already at ${oldCounter.seq} (>= ${newCounterValue})`);
        }
      }
    }
    
    // Check for other counter formats that might interfere
    const otherCounters = existingCounters.filter(c => {
      const idStr = typeof c._id === 'object' ? c._id.toString() : String(c._id);
      return idStr !== usedCounterId && 
             (idStr.includes('refId') || idStr.includes('RefId') || /^[0-9a-f]{24}$/i.test(idStr));
    });
    if (otherCounters.length > 0) {
      console.log(`\n⚠️  Warning: Found ${otherCounters.length} other counter(s) that might interfere:`);
      otherCounters.forEach(c => {
        const idStr = typeof c._id === 'object' ? c._id.toString() : String(c._id);
        console.log(`   - ${idStr}: ${c.seq}`);
      });
      console.log(`   💡 The schema now explicitly uses counter ID: "Quote_refId"`);
      console.log(`   💡 Make sure mongoose-sequence is using the correct counter: ${usedCounterId}`);
    }

  } catch (error) {
    console.error("❌ Script failed:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the script
setRefIdCounter()
  .then(() => {
    console.log("\n✅ Set refId counter script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Script execution failed:", error);
    process.exit(1);
  });
