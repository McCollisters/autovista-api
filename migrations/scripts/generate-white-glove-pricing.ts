/**
 * Generate White Glove Pricing for Recent Quotes
 *
 * This script generates white glove pricing values for quotes created in the past 100 days.
 * It recalculates vehicle pricing and total pricing to ensure white glove values are populated.
 *
 * IMPORTANT: This script will recalculate ALL pricing for quotes, not just white glove.
 * It uses the same recalculation logic as the quote creation/update flow.
 *
 * To run this script:
 * 1. Set your MongoDB connection string:
 *    export MONGODB_URI="mongodb://localhost:27017/database"
 *    (Or use MONGODB_DEV_URI)
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/generate-white-glove-pricing.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Quote } from "@/_global/models";
import { getMiles } from "@/quote/services/getMiles";
import { updateVehiclesWithPricing } from "@/quote/services/updateVehiclesWithPricing";
import { calculateTotalPricing } from "@/quote/services/calculateTotalPricing";

dotenv.config();

const BATCH_SIZE = 50; // Smaller batch size since we're doing more processing per quote
const DAYS_BACK = 100;

/**
 * Generate white glove pricing for quotes created in the past N days
 */
async function generateWhiteGlovePricing() {
  console.log("\n=== Generating White Glove Pricing for Recent Quotes ===");

  let skipCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Calculate date threshold (100 days ago)
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - DAYS_BACK);

  console.log(`Looking for quotes created after: ${dateThreshold.toISOString()}`);

  // Get total count
  const totalQuotes = await Quote.countDocuments({
    createdAt: { $gte: dateThreshold },
  });
  console.log(`Total quotes to process: ${totalQuotes}`);

  while (skipCount < totalQuotes) {
    console.log(`\nFetching quotes batch starting at ${skipCount}...`);

    // Fetch batch of quotes with portal populated
    const quotes = await Quote.find({
      createdAt: { $gte: dateThreshold },
    })
      .populate("portalId")
      .sort({ createdAt: 1 })
      .skip(skipCount)
      .limit(BATCH_SIZE)
      .lean();

    if (quotes.length === 0) {
      break; // No more quotes to process
    }

    console.log(`Processing ${quotes.length} quotes in this batch...`);

    // Process each quote
    for (const quote of quotes) {
      try {
        // Skip if quote doesn't have required fields
        if (!quote.portalId || !quote.vehicles || quote.vehicles.length === 0) {
          console.log(
            `Skipping quote ${quote.refId || quote._id}: missing portal or vehicles`,
          );
          skippedCount++;
          continue;
        }

        const portal = quote.portalId as any;

        // Get vehicles as plain objects
        const vehicles = quote.vehicles.map((v: any) => {
          const vehicle = v.toObject ? v.toObject() : v;
          return vehicle;
        });

        // Get miles - use existing miles or recalculate if coordinates available
        let miles = quote.miles || 0;
        if (
          quote.origin?.coordinates &&
          quote.destination?.coordinates &&
          (!miles || miles === 0)
        ) {
          const recalculatedMiles = await getMiles(
            [
              parseFloat(quote.origin.coordinates.lat),
              parseFloat(quote.origin.coordinates.long),
            ],
            [
              parseFloat(quote.destination.coordinates.lat),
              parseFloat(quote.destination.coordinates.long),
            ],
          );
          if (recalculatedMiles) {
            miles = recalculatedMiles;
          }
        }

        if (!miles || miles === 0) {
          console.log(
            `Skipping quote ${quote.refId || quote._id}: no miles available`,
          );
          skippedCount++;
          continue;
        }

        // Get commission from existing quote
        const commission =
          (quote.totalPricing?.modifiers?.commission as number) || 0;

        // Recalculate vehicle pricing (this will include white glove)
        const vehiclesWithPricing = await updateVehiclesWithPricing({
          vehicles,
          miles,
          origin: (quote.origin?.validated as string) || "",
          destination: (quote.destination?.validated as string) || "",
          portal,
          commission,
        });

        // Recalculate total pricing
        const totalPricing = await calculateTotalPricing(
          vehiclesWithPricing,
          portal,
        );

        // Update quote
        await Quote.updateOne(
          { _id: quote._id },
          {
            $set: {
              vehicles: vehiclesWithPricing,
              totalPricing,
              miles,
            },
          },
        );

        // Check if white glove was actually generated
        const whiteGloveValue =
          totalPricing?.totals?.whiteGlove || 0;
        const previousWhiteGlove =
          (quote.totalPricing?.totals?.whiteGlove as number) || 0;
        
        if (whiteGloveValue > 0) {
          console.log(
            `✓ Updated quote ${quote.refId || quote._id}: white glove = $${whiteGloveValue} (was $${previousWhiteGlove})`,
          );
        } else if (previousWhiteGlove === 0) {
          console.log(
            `✓ Updated quote ${quote.refId || quote._id}: white glove = $0 (unchanged)`,
          );
        } else {
          console.log(
            `✓ Updated quote ${quote.refId || quote._id}: white glove = $0 (was $${previousWhiteGlove})`,
          );
        }

        updatedCount++;
      } catch (error) {
        errorCount++;
        console.error(
          `Error processing quote ${quote.refId || quote._id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    skipCount += quotes.length;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total quotes checked: ${totalQuotes}`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);

  return { updatedCount, skippedCount, errorCount };
}

/**
 * Main function
 */
async function main() {
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      process.env.MONGODB_DEV_URI ||
      "mongodb://localhost:27017/autovista";

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Generate white glove pricing
    const results = await generateWhiteGlovePricing();

    // Print final summary
    console.log("\n=== Final Summary ===");
    console.log(
      `Updated: ${results.updatedCount}, Skipped: ${results.skippedCount}, Errors: ${results.errorCount}`,
    );

    // Close connection
    await mongoose.connection.close();
    console.log("\nDisconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("Fatal error:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();
