/**
 * Fix COD paymentType and hasPaid fields for orders.
 *
 * Rules:
 * - If paymentType is "COD" in the source, set to "cod" in destination.
 * - If paid is true in source, hasPaid should be true, otherwise false.
 *
 * To run:
 * 1. Set MongoDB connection string:
 *    export MONGODB_URI="mongodb://localhost:27017/database"
 *    (Or use MONGODB_DEV_URI)
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/fix-cod-has-paid.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Order } from "@/_global/models";

dotenv.config();

const BATCH_SIZE = 1000;

async function fixOrders() {
  console.log("\n=== Fixing Orders (paymentType + hasPaid) ===");

  let skipCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  const totalOrders = await Order.countDocuments({});
  console.log(`Total orders to check: ${totalOrders}`);

  while (skipCount < totalOrders) {
    console.log(`\nFetching orders batch starting at ${skipCount}...`);

    const orders = await Order.find({})
      .skip(skipCount)
      .limit(BATCH_SIZE)
      .lean();

    if (orders.length === 0) {
      break;
    }

    console.log(`Processing ${orders.length} orders in this batch...`);

    const bulkOps: any[] = [];

    for (const order of orders) {
      try {
        const updateFields: Record<string, unknown> = {};
        let needsUpdate = false;

        if (order.paymentType === "COD") {
          updateFields.paymentType = "cod";
          needsUpdate = true;
        }

        const normalizedPaymentType =
          typeof order.paymentType === "string"
            ? order.paymentType.toLowerCase()
            : order.paymentType;

        if (normalizedPaymentType === "cod") {
          if (order.paymentType !== "cod") {
            updateFields.paymentType = "cod";
            needsUpdate = true;
          }
          const nextHasPaid = order.paid === false ? false : true;
          if (order.hasPaid !== nextHasPaid) {
            updateFields.hasPaid = nextHasPaid;
            needsUpdate = true;
          }
        } else if (order.hasPaid !== null) {
          updateFields.hasPaid = null;
          needsUpdate = true;
        }

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

async function main() {
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      process.env.MONGODB_DEV_URI ||
      "mongodb://localhost:27017/autovista";

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const orderResults = await fixOrders();

    console.log("\n=== Final Summary ===");
    console.log(
      `Orders - Updated: ${orderResults.updatedCount}, Skipped: ${orderResults.skippedCount}, Errors: ${orderResults.errorCount}`,
    );

    await mongoose.connection.close();
    console.log("\nDisconnected from MongoDB");
    console.log("Script completed successfully!");
  } catch (error) {
    console.error("Error running script:", error);
    process.exit(1);
  }
}

main();
