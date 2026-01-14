/**
 * Fix Vehicle Totals Migration Script
 *
 * This script fixes vehicle-level pricing totals for quotes where 3/5/7-day
 * service level totals are 0 but the quote-level totalPricing has correct values.
 *
 * It backfills vehicle totals by dividing quote-level totals by the number of vehicles,
 * or using quote totals directly if there's only one vehicle.
 *
 * To run this script:
 * 1. Set your MongoDB connection string:
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/fix-vehicle-totals.ts
 */

import "dotenv/config";
import {
  MigrationBase,
  MigrationResult,
  MigrationUtils,
} from "../utils/migration-base";

export class FixVehicleTotalsMigration extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running fix vehicle totals migration UP...");

      // Get source connection to read original calculatedQuotes data
      const sourceConnection = this.getSourceConnection();
      const sourceDb = sourceConnection.db;

      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!sourceDb || !destinationDb) {
        throw new Error("Database connections not available");
      }

      const sourceQuotesCollection = sourceDb.collection("quotes");
      const destinationQuotesCollection = destinationDb.collection("quotes");

      // Find quotes in destination from the past 365 days where vehicle totals might be missing for 3/5/7-day
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      console.log(`📅 Filtering quotes from the past 365 days (since ${oneYearAgo.toISOString()})`);
      
      // Find all quotes from the past year that have pricing data
      const destinationQuotes = await destinationQuotesCollection
        .find({
          createdAt: { $gte: oneYearAgo },
          "totalPricing.totals": { $exists: true },
          "vehicles.pricing.totals": { $exists: true },
        })
        .toArray();

      console.log(`📦 Found ${destinationQuotes.length} quotes to check from the past 365 days`);

      let fixedCount = 0;
      let skippedCount = 0;
      let notFoundCount = 0;

      // Process in large batches to avoid overloading the database
      // Using batch size of 50 for efficient processing
      console.log(`🚀 Starting to process ${destinationQuotes.length} quotes in batches of 50...`);
      
      await MigrationUtils.batchProcess(
        destinationQuotes,
        async (destQuote: any, index) => {
          try {
            // Get the original quote from source to access calculatedQuotes
            const sourceQuote = await sourceQuotesCollection.findOne({
              _id: destQuote._id,
            });

            if (!sourceQuote) {
              // Don't log every missing quote - it's expected for newer quotes
              notFoundCount++;
              return;
            }

            if (!sourceQuote.vehicleQuotes || sourceQuote.vehicleQuotes.length === 0) {
              console.log(`⚠️  Quote ${destQuote._id} (uniqueId: ${destQuote.uniqueId}) has no vehicleQuotes in source`);
              skippedCount++;
              return;
            }

            const vehicles = destQuote.vehicles || [];
            const sourceVehicleQuotes = sourceQuote.vehicleQuotes || [];

            if (vehicles.length === 0 || sourceVehicleQuotes.length === 0) {
              skippedCount++;
              return;
            }

            // Re-transform vehicle totals using the fixed migration logic
            let needsFix = false;
            let updatedVehicles = [];

            for (let i = 0; i < vehicles.length; i++) {
              const vehicle = vehicles[i];
              const sourceVehicle = sourceVehicleQuotes[i];

              if (!sourceVehicle?.calculatedQuotes || sourceVehicle.calculatedQuotes.length === 0) {
                updatedVehicles.push(vehicle);
                continue;
              }

              const vehicleTotals = vehicle.pricing?.totals;
              if (!vehicleTotals) {
                updatedVehicles.push(vehicle);
                continue;
              }

              // Check if vehicle needs fixing (has zeros for 3/5/7-day)
              const quoteThreeTotal = destQuote.totalPricing?.totals?.three?.open?.total || destQuote.totalPricing?.totals?.three?.total || 0;
              const vehicleThreeTotal = vehicleTotals.three?.open?.total || vehicleTotals.three?.total || 0;
              const hasThreeDayIssue = quoteThreeTotal > 0 && vehicleThreeTotal === 0;
              
              const quoteFiveTotal = destQuote.totalPricing?.totals?.five?.open?.total || destQuote.totalPricing?.totals?.five?.total || 0;
              const vehicleFiveTotal = vehicleTotals.five?.open?.total || vehicleTotals.five?.total || 0;
              const hasFiveDayIssue = quoteFiveTotal > 0 && vehicleFiveTotal === 0;
              
              const quoteSevenTotal = destQuote.totalPricing?.totals?.seven?.open?.total || destQuote.totalPricing?.totals?.seven?.total || 0;
              const vehicleSevenTotal = vehicleTotals.seven?.open?.total || vehicleTotals.seven?.total || 0;
              const hasSevenDayIssue = quoteSevenTotal > 0 && vehicleSevenTotal === 0;

              // Also check if there are leftover top-level total properties that need cleanup
              // Check if the property exists (even if it's 0, null, etc.)
              const hasThreeLeftover = vehicleTotals.three && 'total' in vehicleTotals.three && vehicleTotals.three.open;
              const hasFiveLeftover = vehicleTotals.five && 'total' in vehicleTotals.five && vehicleTotals.five.open;
              const hasSevenLeftover = vehicleTotals.seven && 'total' in vehicleTotals.seven && vehicleTotals.seven.open;
              const hasLeftoverProps = Boolean(hasThreeLeftover || hasFiveLeftover || hasSevenLeftover);

              // Only log details for quotes that need fixing (to reduce noise)
              if (hasThreeDayIssue || hasFiveDayIssue || hasSevenDayIssue || hasLeftoverProps) {
                console.log(`🔍 Vehicle ${i} check (quote ${destQuote._id}):`, {
                  quoteThreeTotal,
                  vehicleThreeTotal,
                  hasThreeDayIssue,
                  quoteFiveTotal,
                  vehicleFiveTotal,
                  hasFiveDayIssue,
                  quoteSevenTotal,
                  vehicleSevenTotal,
                  hasSevenDayIssue,
                  hasLeftoverProps,
                });
              }

              // Always process the vehicle to check for cleanup, even if values are correct
              // Re-transform using the fixed migration logic
              const vehicleCopy = JSON.parse(JSON.stringify(vehicle));
              // Deep clone vehicleTotals, ensuring it exists
              const vehicleTotalsCopy = vehicleTotals ? JSON.parse(JSON.stringify(vehicleTotals)) : {};
              
              // Always attempt cleanup - don't skip even if no issues detected
              
              // If we need to re-process calculatedQuotes (has zeros), do that
              if (hasThreeDayIssue || hasFiveDayIssue || hasSevenDayIssue) {
                // Process calculatedQuotes to extract 3/5/7-day data
                sourceVehicle.calculatedQuotes.forEach((quote: any) => {
                const daysRaw = quote.days ?? quote.serviceLevelOption ?? null;
                if (daysRaw === null) return;

                const days = String(daysRaw).trim();
                const openTotalSD = quote.openTransportSD || quote.totalSD || 0;
                const openTotalPortal = quote.openTransportPortal || quote.totalPortal || 0;
                const companyTariffOpen = quote.companyTariffOpen || quote.companyTariff || 0;
                const companyTariffEnclosed = quote.companyTariffEnclosed || quote.companyTariff || 0;
                const commission = quote.commission || 0;
                const enclosedTotalSD = quote.enclosedTransportSD || 0;
                const enclosedTotalPortal = quote.enclosedTransportPortal || 0;

                if (days === "3") {
                  // Initialize structure if it doesn't exist
                  if (!vehicleTotalsCopy.three) {
                    vehicleTotalsCopy.three = {};
                  }
                  if (!vehicleTotalsCopy.three.open) {
                    vehicleTotalsCopy.three.open = { total: 0, companyTariff: 0, commission: 0, totalWithCompanyTariffAndCommission: 0 };
                  }
                  if (!vehicleTotalsCopy.three.enclosed) {
                    vehicleTotalsCopy.three.enclosed = { total: 0, companyTariff: 0, commission: 0, totalWithCompanyTariffAndCommission: 0 };
                  }
                  
                  vehicleTotalsCopy.three.open.total = openTotalSD;
                  vehicleTotalsCopy.three.open.companyTariff = companyTariffOpen;
                  vehicleTotalsCopy.three.open.commission = commission;
                  vehicleTotalsCopy.three.open.totalWithCompanyTariffAndCommission = openTotalPortal;
                  vehicleTotalsCopy.three.enclosed.total = enclosedTotalSD;
                  vehicleTotalsCopy.three.enclosed.companyTariff = companyTariffEnclosed;
                  vehicleTotalsCopy.three.enclosed.commission = commission;
                  vehicleTotalsCopy.three.enclosed.totalWithCompanyTariffAndCommission = enclosedTotalPortal;
                  needsFix = true;
                } else if (days === "5") {
                  // Initialize structure if it doesn't exist
                  if (!vehicleTotalsCopy.five) {
                    vehicleTotalsCopy.five = {};
                  }
                  if (!vehicleTotalsCopy.five.open) {
                    vehicleTotalsCopy.five.open = { total: 0, companyTariff: 0, commission: 0, totalWithCompanyTariffAndCommission: 0 };
                  }
                  if (!vehicleTotalsCopy.five.enclosed) {
                    vehicleTotalsCopy.five.enclosed = { total: 0, companyTariff: 0, commission: 0, totalWithCompanyTariffAndCommission: 0 };
                  }
                  
                  vehicleTotalsCopy.five.open.total = openTotalSD;
                  vehicleTotalsCopy.five.open.companyTariff = companyTariffOpen;
                  vehicleTotalsCopy.five.open.commission = commission;
                  vehicleTotalsCopy.five.open.totalWithCompanyTariffAndCommission = openTotalPortal;
                  vehicleTotalsCopy.five.enclosed.total = enclosedTotalSD;
                  vehicleTotalsCopy.five.enclosed.companyTariff = companyTariffEnclosed;
                  vehicleTotalsCopy.five.enclosed.commission = commission;
                  vehicleTotalsCopy.five.enclosed.totalWithCompanyTariffAndCommission = enclosedTotalPortal;
                  needsFix = true;
                } else if (days === "7") {
                  // Initialize structure if it doesn't exist
                  if (!vehicleTotalsCopy.seven) {
                    vehicleTotalsCopy.seven = {};
                  }
                  if (!vehicleTotalsCopy.seven.open) {
                    vehicleTotalsCopy.seven.open = { total: 0, companyTariff: 0, commission: 0, totalWithCompanyTariffAndCommission: 0 };
                  }
                  if (!vehicleTotalsCopy.seven.enclosed) {
                    vehicleTotalsCopy.seven.enclosed = { total: 0, companyTariff: 0, commission: 0, totalWithCompanyTariffAndCommission: 0 };
                  }
                  
                  vehicleTotalsCopy.seven.open.total = openTotalSD;
                  vehicleTotalsCopy.seven.open.companyTariff = companyTariffOpen;
                  vehicleTotalsCopy.seven.open.commission = commission;
                  vehicleTotalsCopy.seven.open.totalWithCompanyTariffAndCommission = openTotalPortal;
                  vehicleTotalsCopy.seven.enclosed.total = enclosedTotalSD;
                  vehicleTotalsCopy.seven.enclosed.companyTariff = companyTariffEnclosed;
                  vehicleTotalsCopy.seven.enclosed.commission = commission;
                  vehicleTotalsCopy.seven.enclosed.totalWithCompanyTariffAndCommission = enclosedTotalPortal;
                  needsFix = true;
                }
              });
              } // End of re-processing calculatedQuotes

              // ALWAYS clean up leftover top-level properties if they exist
              // These properties should ONLY exist in .open and .enclosed, not at the top level
              let cleanedUp = false;
              
              const propsToRemove = ['total', 'companyTariff', 'commission', 'totalWithCompanyTariffAndCommission'];
              
              // Check for three
              if (vehicleTotalsCopy.three && vehicleTotalsCopy.three.open) {
                for (const prop of propsToRemove) {
                  if (vehicleTotalsCopy.three.hasOwnProperty(prop)) {
                    console.log(`  🗑️  Removing three.${prop}`);
                    delete vehicleTotalsCopy.three[prop];
                    cleanedUp = true;
                  }
                }
              }
              
              // Check for five
              if (vehicleTotalsCopy.five && vehicleTotalsCopy.five.open) {
                for (const prop of propsToRemove) {
                  if (vehicleTotalsCopy.five.hasOwnProperty(prop)) {
                    console.log(`  🗑️  Removing five.${prop}`);
                    delete vehicleTotalsCopy.five[prop];
                    cleanedUp = true;
                  }
                }
              }
              
              // Check for seven
              if (vehicleTotalsCopy.seven && vehicleTotalsCopy.seven.open) {
                for (const prop of propsToRemove) {
                  if (vehicleTotalsCopy.seven.hasOwnProperty(prop)) {
                    console.log(`  🗑️  Removing seven.${prop}`);
                    delete vehicleTotalsCopy.seven[prop];
                    cleanedUp = true;
                  }
                }
              }
              
              // Always update the vehicle structure to ensure it's clean
              // Even if we didn't detect leftover props, ensure the structure is correct
              vehicleCopy.pricing = {
                ...vehicle.pricing,
                totals: vehicleTotalsCopy,
              };
              
              if (cleanedUp) {
                console.log(`🧹 Cleaned up leftover properties for vehicle ${i}`);
              }
              
              // Mark as needing update if we made any changes
              if (needsFix || cleanedUp) {
                // Already set above
              }

              updatedVehicles.push(vehicleCopy);
            }

            // Check if any vehicle was actually modified by comparing JSON
            const anyVehicleModified = updatedVehicles.some((updatedVehicle, idx) => {
              const originalVehicle = vehicles[idx];
              const originalTotals = JSON.stringify(originalVehicle.pricing?.totals || {});
              const updatedTotals = JSON.stringify(updatedVehicle.pricing?.totals || {});
              return originalTotals !== updatedTotals;
            });
            
            if (anyVehicleModified) {
              await destinationQuotesCollection.updateOne(
                { _id: destQuote._id },
                { $set: { vehicles: updatedVehicles } }
              );
              fixedCount++;
              
              // Log progress every 100 quotes
              if (fixedCount % 100 === 0) {
                console.log(`📊 Progress: Fixed ${fixedCount} quotes, skipped ${skippedCount}, not found ${notFoundCount}`);
              }
            } else {
              skippedCount++;
            }
          } catch (error) {
            console.error(`❌ Error processing quote ${destQuote._id}:`, error);
          }
        },
        50, // batchSize - process 50 quotes at a time for efficiency
      );

      console.log(
        `✅ Fix vehicle totals completed: ${fixedCount} fixed, ${skippedCount} skipped, ${notFoundCount} not found in source`,
      );

      return {
        success: true,
        message: `Successfully fixed ${fixedCount} quotes, ${skippedCount} skipped, ${notFoundCount} not found in source`,
        recordsAffected: fixedCount,
      };
    } catch (error) {
      console.error("❌ Fix vehicle totals migration failed:", error);
      throw error;
    }
  }

  async down(): Promise<MigrationResult> {
    // This migration doesn't have a rollback - the fix is additive
    return {
      success: true,
      message: "No rollback needed for this migration",
      recordsAffected: 0,
    };
  }
}

// Run if this file is executed directly
const isMainModule = 
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1]) ||
  process.argv[1]?.includes("fix-vehicle-totals");

if (isMainModule) {
  const migration = new FixVehicleTotalsMigration();

  const direction = process.argv[2] === "down" ? "down" : "up";

  migration
    .run(direction)
    .then((result) => {
      console.log("\n✅ Script completed");
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("💥 Migration execution failed:", error);
      process.exit(1);
    });
}
