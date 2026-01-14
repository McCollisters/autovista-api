/**
 * Generate White Glove Pricing for Recent Quotes
 *
 * This script generates white glove pricing values for quotes created between 100-200 days ago.
 * It ONLY updates white glove pricing values - all other pricing (service levels, modifiers, etc.)
 * is preserved exactly as it was.
 *
 * IMPORTANT: This script only calculates and updates white glove pricing. It does NOT
 * recalculate service level totals or any other pricing values.
 *
 * To run this script:
 * 1. Set your MongoDB connection string:
 *    export MONGODB_URI="mongodb://localhost:27017/database"
 *    (Or use MONGODB_DEV_URI)
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/generate-white-glove-pricing.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Quote, ModifierSet } from "@/_global/models";
import { getMiles } from "@/quote/services/getMiles";

dotenv.config();

const BATCH_SIZE = 500; // Process 500 quotes at once
const DAYS_BACK_START = 200; // Start from 200 days ago
const DAYS_BACK_END = 100; // End at 100 days ago

/**
 * Generate white glove pricing for quotes created between 100-200 days ago
 */
async function generateWhiteGlovePricing() {
  console.log("\n=== Generating White Glove Pricing for Quotes (100-200 days ago) ===");

  let skipCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Calculate date range (100-200 days ago)
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - DAYS_BACK_END);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DAYS_BACK_START);

  console.log(`Looking for quotes created between: ${startDate.toISOString()} and ${endDate.toISOString()}`);

  // Get total count
  const totalQuotes = await Quote.countDocuments({
    createdAt: { $gte: startDate, $lt: endDate },
  });
  console.log(`Total quotes to process: ${totalQuotes}`);

  while (skipCount < totalQuotes) {
    console.log(`\nFetching quotes batch starting at ${skipCount}...`);

    // Fetch batch of quotes with portal populated
    const quotes = await Quote.find({
      createdAt: { $gte: startDate, $lt: endDate },
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

        // Get white glove multiplier from modifiers
        const globalModifiersDoc = await ModifierSet.findOne({
          isGlobal: true,
        }).lean();

        if (!globalModifiersDoc) {
          console.log(
            `Skipping quote ${quote.refId || quote._id}: global modifiers not found`,
          );
          skippedCount++;
          continue;
        }

        const globalModifiers = globalModifiersDoc as any;
        const portalModifiers = (await ModifierSet.findOne({
          portalId: portal._id,
        }).lean()) as any;

        const whiteGloveMultiplier = portalModifiers?.whiteGlove
          ? portalModifiers.whiteGlove.multiplier
          : globalModifiers.whiteGlove?.multiplier || 2;

        // Calculate white glove pricing per vehicle (preserve all other pricing)
        let totalWhiteGlove = 0;
        const updatedVehicles = quote.vehicles.map((vehicle: any) => {
          const vehicleObj = vehicle.toObject ? vehicle.toObject() : vehicle;
          
          // Calculate white glove for this vehicle
          let baseWhiteGlove = miles * whiteGloveMultiplier;
          if (
            globalModifiers.whiteGlove?.minimum &&
            baseWhiteGlove < globalModifiers.whiteGlove.minimum
          ) {
            baseWhiteGlove = globalModifiers.whiteGlove.minimum;
          }

          // Round to nearest dollar (matching the pricing calculation)
          const whiteGloveValue = Math.round(baseWhiteGlove);
          totalWhiteGlove += whiteGloveValue;

          // Update only the white glove value, preserve everything else
          return {
            ...vehicleObj,
            pricing: {
              ...vehicleObj.pricing,
              totals: {
                ...vehicleObj.pricing?.totals,
                whiteGlove: whiteGloveValue,
              },
            },
          };
        });

        // Update only the white glove total in totalPricing, preserve everything else
        const updatedTotalPricing = {
          ...quote.totalPricing,
          totals: {
            ...quote.totalPricing?.totals,
            whiteGlove: totalWhiteGlove,
          },
        };

        // Update quote - only update vehicles and totalPricing white glove values
        await Quote.updateOne(
          { _id: quote._id },
          {
            $set: {
              vehicles: updatedVehicles,
              "totalPricing.totals.whiteGlove": totalWhiteGlove,
            },
          },
        );

        // Check if white glove was actually generated
        const previousWhiteGlove =
          (quote.totalPricing?.totals?.whiteGlove as number) || 0;

        if (totalWhiteGlove > 0) {
          console.log(
            `✓ Updated quote ${quote.refId || quote._id}: white glove = $${totalWhiteGlove} (was $${previousWhiteGlove})`,
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
