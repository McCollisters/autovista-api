/**
 * Fix Quote ID Types Script
 *
 * This script updates existing quotes in the database where portalId or userId
 * are stored as strings instead of ObjectIds. It converts all string portalId
 * and userId values to ObjectId format.
 *
 * IMPORTANT: This script only updates quotes where portalId or userId are strings.
 * Quotes where these fields are already ObjectIds or are null/undefined will be skipped.
 *
 * To run this script:
 * 1. Set your MongoDB connection string:
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 *    (Or use MONGODB_URI or MONGODB_DEV_URI)
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/fix-quote-ids.ts
 */

import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import { Quote } from "@/_global/models";

dotenv.config();

async function fixQuoteIds() {
  try {
    // Connect to database
    const mongoUri =
      process.env.MIGRATION_DEST_URI ||
      process.env.MONGODB_URI ||
      process.env.MONGODB_DEV_URI;
    if (!mongoUri) {
      throw new Error(
        "MIGRATION_DEST_URI, MONGODB_URI, or MONGODB_DEV_URI environment variable is required",
      );
    }

    console.log("Connecting to database...");
    await mongoose.connect(mongoUri);
    console.log("Connected to database successfully");

    // Configuration
    const BATCH_SIZE = 1000; // Process 1000 quotes at a time

    // Count total quotes
    const totalQuotes = await Quote.countDocuments({});
    console.log(`Total quotes in database: ${totalQuotes}`);
    console.log(`Processing in batches of ${BATCH_SIZE}`);

    let portalIdUpdatedCount = 0;
    let userIdUpdatedCount = 0;
    let bothUpdatedCount = 0;
    let errorCount = 0;
    let processedCount = 0;
    let skipCount = 0;
    let skippedCount = 0; // Quotes that don't need updating

    // Process in batches
    while (skipCount < totalQuotes) {
      console.log(`\nFetching batch starting at ${skipCount}...`);

      // Fetch batch of quotes
      const quotes = await Quote.find({})
        .skip(skipCount)
        .limit(BATCH_SIZE)
        .lean();

      if (quotes.length === 0) {
        break; // No more quotes to process
      }

      console.log(`Processing ${quotes.length} quotes in this batch...`);

      // Prepare bulk operations
      const bulkOps: any[] = [];

      for (const quote of quotes) {
        try {
          const portalId = quote.portalId;
          const userId = quote.userId;

          // Track if we need to update this quote
          let needsUpdate = false;
          const updateFields: any = {};

          // Check portalId
          if (portalId && typeof portalId === "string") {
            // Validate that the string is a valid ObjectId format
            if (!Types.ObjectId.isValid(portalId)) {
              errorCount++;
              console.error(
                `Invalid ObjectId format for portalId in quote ${quote._id}: ${portalId}`,
              );
            } else {
              // Convert string to ObjectId
              updateFields.portalId = new Types.ObjectId(portalId);
              needsUpdate = true;
            }
          }

          // Check userId
          if (userId && typeof userId === "string") {
            // Validate that the string is a valid ObjectId format
            if (!Types.ObjectId.isValid(userId)) {
              errorCount++;
              console.error(
                `Invalid ObjectId format for userId in quote ${quote._id}: ${userId}`,
              );
            } else {
              // Convert string to ObjectId
              updateFields.userId = new Types.ObjectId(userId);
              needsUpdate = true;
            }
          }

          // Add bulk operation if we have updates
          if (needsUpdate && Object.keys(updateFields).length > 0) {
            bulkOps.push({
              updateOne: {
                filter: { _id: quote._id },
                update: { $set: updateFields },
              },
            });

            // Track what was updated
            if (updateFields.portalId && updateFields.userId) {
              bothUpdatedCount++;
            } else if (updateFields.portalId) {
              portalIdUpdatedCount++;
            } else if (updateFields.userId) {
              userIdUpdatedCount++;
            }
          } else {
            // If neither field needs updating, skip
            skippedCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`Error processing quote ${quote._id}:`, error);
        }
      }

      // Execute bulk write
      if (bulkOps.length > 0) {
        console.log(`Updating ${bulkOps.length} quotes in bulk...`);
        const result = await Quote.bulkWrite(bulkOps);
        const totalUpdated =
          portalIdUpdatedCount + userIdUpdatedCount + bothUpdatedCount;
        console.log(
          `Updated ${result.modifiedCount} quotes in this batch (${totalUpdated} total updates across all fields)`,
        );
      }

      processedCount += quotes.length;
      skipCount += BATCH_SIZE;

      console.log(
        `Progress: ${processedCount} quotes processed, ${portalIdUpdatedCount} portalId updates, ${userIdUpdatedCount} userId updates, ${bothUpdatedCount} both updated, ${skippedCount} skipped`,
      );
    }

    console.log(`\nUpdate complete!`);
    console.log(`Total quotes processed: ${processedCount}`);
    console.log(`Quotes with portalId updated: ${portalIdUpdatedCount}`);
    console.log(`Quotes with userId updated: ${userIdUpdatedCount}`);
    console.log(`Quotes with both updated: ${bothUpdatedCount}`);
    console.log(
      `Total field updates: ${portalIdUpdatedCount + userIdUpdatedCount + bothUpdatedCount * 2}`,
    );
    console.log(`Quotes skipped (already ObjectId or null): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);

    await mongoose.connection.close();
    console.log("Database connection closed");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

fixQuoteIds()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
