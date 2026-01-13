/**
 * Fix Base Price Oversize Script
 *
 * This script updates existing orders in the database to remove oversize modifiers
 * from the base price in totalPricing. The base price should exclude all modifiers
 * (including oversize).
 *
 * To run this script:
 * 1. Set your MongoDB connection strings (same as migration scripts):
 *    export MIGRATION_SOURCE_URI="mongodb://localhost:27017/source-database"
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 *    (Or use MONGODB_URI for single database)
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/fix-base-price-oversize.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Order } from "@/_global/models";

dotenv.config();

async function fixBasePriceOversize() {
  try {
    // Connect to database - use MIGRATION_DEST_URI, MONGODB_URI, or MONGODB_DEV_URI
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
    const SKIP_COUNT = 0; // Start from the beginning (process all orders)
    const BATCH_SIZE = 1000; // Process 1000 orders at a time

    // Count total orders
    const totalOrders = await Order.countDocuments({});
    console.log(`Total orders in database: ${totalOrders}`);
    console.log(`Processing all orders from the beginning`);
    console.log(`Processing in batches of ${BATCH_SIZE}`);

    let updatedCount = 0;
    let errorCount = 0;
    let processedCount = 0;
    let skipCount = SKIP_COUNT;

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
          const totalPricing = order.totalPricing;
          if (!totalPricing || totalPricing.base === undefined) {
            continue; // Skip orders without totalPricing or base
          }

          // Calculate total oversize modifier
          const totalOversizeModifier = totalPricing.modifiers?.oversize || 0;

          // Process vehicles to fix vehicle-level base prices
          const vehicles = order.vehicles || [];
          let vehicleUpdates: any = {};
          let vehicleBaseSum = 0;
          let hasVehicleChanges = false;

          vehicles.forEach((vehicle: any, index: number) => {
            const vehiclePricing = vehicle?.pricing;
            if (!vehiclePricing || vehiclePricing.base === undefined) {
              return;
            }

            // Calculate vehicle-level oversize modifier
            const vehicleOversizeModifier =
              vehiclePricing.modifiers?.oversize || 0;

            // Calculate new vehicle base price (remove oversize from base)
            const newVehicleBase = Math.max(
              0,
              vehiclePricing.base - vehicleOversizeModifier,
            );

            // Track if this vehicle needs updating
            if (newVehicleBase !== vehiclePricing.base) {
              vehicleUpdates[`vehicles.${index}.pricing.base`] = newVehicleBase;
              hasVehicleChanges = true;
            }

            // Sum up NEW vehicle bases for total base recalculation
            vehicleBaseSum += newVehicleBase;
          });

          // Calculate new total base price (sum of vehicle bases after removing oversize)
          const newTotalBase = vehicleBaseSum;

          // Prepare update object
          const updateFields: any = {};

          // Update total pricing base if needed
          if (newTotalBase !== totalPricing.base && totalOversizeModifier > 0) {
            updateFields["totalPricing.base"] = newTotalBase;
          }

          // Add vehicle updates if any
          if (hasVehicleChanges) {
            Object.assign(updateFields, vehicleUpdates);
          }

          // Only add to bulk ops if there are changes
          if (Object.keys(updateFields).length > 0) {
            bulkOps.push({
              updateOne: {
                filter: { _id: order._id },
                update: { $set: updateFields },
              },
            });
          }
        } catch (error) {
          errorCount++;
          console.error(`Error processing order ${order._id}:`, error);
        }
      }

      // Execute bulk operations
      if (bulkOps.length > 0) {
        console.log(`Updating ${bulkOps.length} orders in bulk...`);
        const result = await Order.bulkWrite(bulkOps);
        updatedCount += result.modifiedCount;
        console.log(`Updated ${result.modifiedCount} orders in this batch`);
      }

      processedCount += orders.length;
      skipCount += BATCH_SIZE;

      console.log(
        `Progress: ${processedCount} orders processed, ${updatedCount} orders updated`,
      );
    }

    console.log(`\nUpdate complete!`);
    console.log(`Total orders processed: ${processedCount}`);
    console.log(`Orders updated: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);

    // Close database connection
    await mongoose.connection.close();
    console.log("Database connection closed");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run the script
fixBasePriceOversize()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
