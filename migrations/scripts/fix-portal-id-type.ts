/**
 * Fix Portal ID Type Script
 *
 * This script updates existing orders in the database where portalId is stored as a string
 * instead of an ObjectId. It converts all string portalId values to ObjectId format.
 *
 * IMPORTANT: This script only updates orders where portalId is a string. Orders where
 * portalId is already an ObjectId or is null/undefined will be skipped.
 *
 * To run this script:
 * 1. Set your MongoDB connection string:
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 *    (Or use MONGODB_URI or MONGODB_DEV_URI)
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/fix-portal-id-type.ts
 */

import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import { Order } from "@/_global/models";

dotenv.config();

async function fixPortalIdType() {
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
    const BATCH_SIZE = 1000; // Process 1000 orders at a time

    // Count total orders
    const totalOrders = await Order.countDocuments({});
    console.log(`Total orders in database: ${totalOrders}`);
    console.log(`Processing in batches of ${BATCH_SIZE}`);

    let updatedCount = 0;
    let errorCount = 0;
    let processedCount = 0;
    let skipCount = 0;
    let skippedCount = 0; // Orders that don't need updating

    // Process in batches
    while (skipCount < totalOrders) {
      console.log(`\nFetching batch starting at ${skipCount}...`);

      // Fetch batch of orders
      const orders = await Order.find({})
        .skip(skipCount)
        .limit(BATCH_SIZE)
        .lean();

      if (orders.length === 0) {
        break; // No more orders to process
      }

      console.log(`Processing ${orders.length} orders in this batch...`);

      // Prepare bulk operations
      const bulkOps: any[] = [];

      for (const order of orders) {
        try {
          const portalId = order.portalId;

          // Skip if portalId is null or undefined
          if (!portalId) {
            skippedCount++;
            continue;
          }

          // Check if portalId is a string (needs conversion)
          // When using .lean(), ObjectIds come back as objects, strings come back as strings
          if (typeof portalId === "string") {
            // Validate that the string is a valid ObjectId format
            if (!Types.ObjectId.isValid(portalId)) {
              errorCount++;
              console.error(
                `Invalid ObjectId format for order ${order._id}: ${portalId}`,
              );
              continue;
            }

            // Convert string to ObjectId
            const objectIdPortalId = new Types.ObjectId(portalId);

            bulkOps.push({
              updateOne: {
                filter: { _id: order._id },
                update: { $set: { portalId: objectIdPortalId } },
              },
            });
          } else {
            // If it's not a string, it's either already an ObjectId (object) or null/undefined
            // Both cases are fine, so we skip
            skippedCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`Error processing order ${order._id}:`, error);
        }
      }

      // Execute bulk write
      if (bulkOps.length > 0) {
        console.log(`Updating ${bulkOps.length} orders in bulk...`);
        const result = await Order.bulkWrite(bulkOps);
        updatedCount += result.modifiedCount;
        console.log(`Updated ${result.modifiedCount} orders in this batch`);
      }

      processedCount += orders.length;
      skipCount += BATCH_SIZE;

      console.log(
        `Progress: ${processedCount} orders processed, ${updatedCount} orders updated, ${skippedCount} skipped`,
      );
    }

    console.log(`\nUpdate complete!`);
    console.log(`Total orders processed: ${processedCount}`);
    console.log(`Orders updated: ${updatedCount}`);
    console.log(`Orders skipped (already ObjectId or null): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);

    await mongoose.connection.close();
    console.log("Database connection closed");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

fixPortalIdType()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
