/**
 * Fix Quote and Order ID Types Script
 *
 * This script updates existing quotes and orders in the database where portalId or userId
 * are stored as strings instead of ObjectIds. It converts all string values to ObjectId format.
 *
 * IMPORTANT: This script only updates records where portalId or userId are strings.
 * Records where these fields are already ObjectIds or are null/undefined will be skipped.
 *
 * To run this script:
 * 1. Set your MongoDB connection string:
 *    export MONGODB_URI="mongodb://localhost:27017/database"
 *    (Or use MONGODB_DEV_URI)
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/fix-quote-order-ids.ts
 */

import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import { Quote, Order } from "@/_global/models";

dotenv.config();

const BATCH_SIZE = 1000;

/**
 * Convert string to ObjectId if valid, otherwise return null
 */
function convertToObjectId(value: any): Types.ObjectId | null {
  if (!value) return null;

  // If already an ObjectId, return as is
  if (value instanceof Types.ObjectId) {
    return value;
  }

  // If it's a string, validate and convert
  if (typeof value === "string") {
    if (Types.ObjectId.isValid(value)) {
      return new Types.ObjectId(value);
    }
    return null;
  }

  // If it's an object with toString method (Mongoose ObjectId from lean query)
  if (value && typeof value.toString === "function") {
    const stringValue = value.toString();
    if (Types.ObjectId.isValid(stringValue)) {
      return new Types.ObjectId(stringValue);
    }
  }

  return null;
}

/**
 * Fix quotes with string portalId or userId
 */
async function fixQuotes() {
  console.log("\n=== Fixing Quotes ===");

  let skipCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Get total count
  const totalQuotes = await Quote.countDocuments({});
  console.log(`Total quotes to check: ${totalQuotes}`);

  while (skipCount < totalQuotes) {
    console.log(`\nFetching quotes batch starting at ${skipCount}...`);

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
        if (portalId) {
          // Check if it's a string or needs conversion
          const isString = typeof portalId === "string";
          const isObjectId =
            portalId instanceof Types.ObjectId ||
            (portalId &&
              typeof portalId.toString === "function" &&
              Types.ObjectId.isValid(portalId.toString()));

          if (isString || (!isObjectId && portalId)) {
            const convertedPortalId = convertToObjectId(portalId);
            if (convertedPortalId) {
              updateFields.portalId = convertedPortalId;
              needsUpdate = true;
            } else {
              errorCount++;
              console.error(
                `Invalid ObjectId format for portalId in quote ${quote._id}: ${portalId}`,
              );
            }
          }
        }

        // Check userId
        if (userId) {
          // Check if it's a string or needs conversion
          const isString = typeof userId === "string";
          const isObjectId =
            userId instanceof Types.ObjectId ||
            (userId &&
              typeof userId.toString === "function" &&
              Types.ObjectId.isValid(userId.toString()));

          if (isString || (!isObjectId && userId)) {
            const convertedUserId = convertToObjectId(userId);
            if (convertedUserId) {
              updateFields.userId = convertedUserId;
              needsUpdate = true;
            } else {
              errorCount++;
              console.error(
                `Invalid ObjectId format for userId in quote ${quote._id}: ${userId}`,
              );
            }
          }
        }

        // Add bulk operation if we have updates
        if (needsUpdate) {
          bulkOps.push({
            updateOne: {
              filter: { _id: quote._id },
              update: { $set: updateFields },
            },
          });
        } else {
          skippedCount++;
        }
      } catch (error) {
        errorCount++;
        console.error(`Error processing quote ${quote._id}:`, error);
      }
    }

    // Execute bulk write
    if (bulkOps.length > 0) {
      const result = await Quote.bulkWrite(bulkOps);
      updatedCount += result.modifiedCount;
      console.log(`Updated ${result.modifiedCount} quotes in this batch`);
    }

    skipCount += quotes.length;
  }

  console.log(`\n=== Quotes Summary ===`);
  console.log(`Total quotes checked: ${totalQuotes}`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped (already correct): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);

  return { updatedCount, skippedCount, errorCount };
}

/**
 * Fix orders with string portalId or userId
 */
async function fixOrders() {
  console.log("\n=== Fixing Orders ===");

  let skipCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Get total count
  const totalOrders = await Order.countDocuments({});
  console.log(`Total orders to check: ${totalOrders}`);

  while (skipCount < totalOrders) {
    console.log(`\nFetching orders batch starting at ${skipCount}...`);

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
        const userId = order.userId;

        // Track if we need to update this order
        let needsUpdate = false;
        const updateFields: any = {};

        // Check portalId
        if (portalId) {
          // Check if it's a string or needs conversion
          const isString = typeof portalId === "string";
          const isObjectId =
            portalId instanceof Types.ObjectId ||
            (portalId &&
              typeof portalId.toString === "function" &&
              Types.ObjectId.isValid(portalId.toString()));

          if (isString || (!isObjectId && portalId)) {
            const convertedPortalId = convertToObjectId(portalId);
            if (convertedPortalId) {
              updateFields.portalId = convertedPortalId;
              needsUpdate = true;
            } else {
              errorCount++;
              console.error(
                `Invalid ObjectId format for portalId in order ${order._id}: ${portalId}`,
              );
            }
          }
        }

        // Check userId
        if (userId) {
          // Check if it's a string or needs conversion
          const isString = typeof userId === "string";
          const isObjectId =
            userId instanceof Types.ObjectId ||
            (userId &&
              typeof userId.toString === "function" &&
              Types.ObjectId.isValid(userId.toString()));

          if (isString || (!isObjectId && userId)) {
            const convertedUserId = convertToObjectId(userId);
            if (convertedUserId) {
              updateFields.userId = convertedUserId;
              needsUpdate = true;
            } else {
              errorCount++;
              console.error(
                `Invalid ObjectId format for userId in order ${order._id}: ${userId}`,
              );
            }
          }
        }

        // Add bulk operation if we have updates
        if (needsUpdate) {
          bulkOps.push({
            updateOne: {
              filter: { _id: order._id },
              update: { $set: updateFields },
            },
          });
        } else {
          skippedCount++;
        }
      } catch (error) {
        errorCount++;
        console.error(`Error processing order ${order._id}:`, error);
      }
    }

    // Execute bulk write
    if (bulkOps.length > 0) {
      const result = await Order.bulkWrite(bulkOps);
      updatedCount += result.modifiedCount;
      console.log(`Updated ${result.modifiedCount} orders in this batch`);
    }

    skipCount += orders.length;
  }

  console.log(`\n=== Orders Summary ===`);
  console.log(`Total orders checked: ${totalOrders}`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped (already correct): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);

  return { updatedCount, skippedCount, errorCount };
}

/**
 * Main function
 */
async function main() {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI ||
      process.env.MONGODB_DEV_URI ||
      "mongodb://localhost:27017/autovista";

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Fix quotes
    const quoteResults = await fixQuotes();

    // Fix orders
    const orderResults = await fixOrders();

    // Print final summary
    console.log("\n=== Final Summary ===");
    console.log(
      `Quotes - Updated: ${quoteResults.updatedCount}, Skipped: ${quoteResults.skippedCount}, Errors: ${quoteResults.errorCount}`,
    );
    console.log(
      `Orders - Updated: ${orderResults.updatedCount}, Skipped: ${orderResults.skippedCount}, Errors: ${orderResults.errorCount}`,
    );
    console.log(
      `Total Updated: ${quoteResults.updatedCount + orderResults.updatedCount}`,
    );
    console.log(
      `Total Errors: ${quoteResults.errorCount + orderResults.errorCount}`,
    );

    // Close connection
    await mongoose.connection.close();
    console.log("\nDisconnected from MongoDB");
    console.log("Script completed successfully!");
  } catch (error) {
    console.error("Error running script:", error);
    process.exit(1);
  }
}

// Run the script
main();
