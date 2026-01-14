import {
  MigrationBase,
  MigrationResult,
  MigrationUtils,
} from "../utils/migration-base";
import { Types } from "mongoose";

// Configuration constants
const MAX_QUOTES_TO_PROCESS: number | null = null; // Set to null or undefined to process all quotes

/**
 * Quote Migration Script
 *
 * This migration transforms quotes from the old format to the new schema structure.
 * Key transformations:
 * - Restructures pricing modifiers from nested objects to flat structure
 * - Transforms vehicle pricing from old format to new format
 * - Updates totalPricing structure to match new schema
 * - Ensures all required fields are present with proper defaults
 *
 * IMPORTANT: This migration processes quotes from the source database and
 * overwrites any existing quotes in the destination database with the same _id.
 *
 * Testing vs Production:
 * - Set MAX_QUOTES_TO_PROCESS = 15 (or any number) for testing with limited quotes
 * - Set MAX_QUOTES_TO_PROCESS = null to process ALL quotes in production
 *
 * To run this migration:
 * 1. Set your MongoDB connection strings:
 *    export MIGRATION_SOURCE_URI="mongodb://localhost:27017/source-database"
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/migrate-quotes.ts
 */

interface OldQuote {
  _id: any;
  uniqueId?: number;
  refId?: number;
  status: string;
  portalId: any;
  userId: any;
  quoteTableVehicles?: any[];
  quoteTablePricing?: any[];
  companyName?: string;
  customerCode?: string;
  userName?: string;
  portal?: any;
  instance?: any;
  customerFullName?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  customerPhone?: string;
  pickupAddressUnformatted?: string;
  deliveryAddressUnformatted?: string;
  pickup: string;
  delivery: string;
  miles: number;
  transitTime: [number, number];
  transportType: string;
  vehicleCount?: number;
  vehicleQuotes: Array<{
    make: string;
    model: string;
    pricingClass: string;
    operable: string;
    operableBool?: boolean;
    _id?: any;
    calculatedQuotes: Array<{
      name: string;
      days: string;
      baseQuote: any;
      commission: number;
      companyTariff: number;
      companyTariffOpen: number;
      companyTariffEnclosed: number;
      enclosedMarkup: number;
      serviceLevelMarkup: number;
      suvMarkup: number;
      vanMarkup: number;
      pickupMarkup: number;
      inoperableMarkup: number;
      irrMakup: number;
      fuelMarkup: number;
      enclosedModifier: number;
      totalDiscount: number;
      totalSD: any;
      totalPortal: any;
      enclosedTransportSD: number;
      enclosedTransportPortal: number;
      openTransportSD: number;
      openTransportPortal: number;
      whiteGloveTransportSD: number;
      whiteGloveTransportPortal: number;
      _id?: any;
    }>;
  }>;
  totalPricing: {
    1: {
      totalSD: any;
      totalPortal: any;
      name: string;
      days: string;
      totalCompanyTariff: any;
      totalEnclosedTransportPortal: any;
      totalEnclosedTransportSD: any;
      totalOpenTransportPortal: any;
      totalOpenTransportSD: any;
      totalWhiteGloveTransportSD: any;
      totalWhiteGloveTransportPortal: any;
      totalSuvMarkup: number;
      totalVanMarkup: number;
      totalPickupMarkup: number;
      totalEnclosedMarkup: number;
      totalInoperableMarkup: number;
      totalIrrMakup: number;
      totalFuelMarkup: number;
    };
    3: {
      totalSD: any;
      totalPortal: any;
      name: string;
      days: string;
      totalCompanyTariff: any;
      totalEnclosedTransportPortal: any;
      totalEnclosedTransportSD: any;
      totalOpenTransportPortal: any;
      totalOpenTransportSD: any;
      totalWhiteGloveTransportSD: any;
      totalWhiteGloveTransportPortal: any;
      totalSuvMarkup: number;
      totalVanMarkup: number;
      totalPickupMarkup: number;
      totalEnclosedMarkup: number;
      totalInoperableMarkup: number;
      totalIrrMakup: number;
      totalFuelMarkup: number;
    };
    5: {
      totalSD: any;
      totalPortal: any;
      name: string;
      days: string;
      totalCompanyTariff: any;
      totalEnclosedTransportPortal: any;
      totalEnclosedTransportSD: any;
      totalOpenTransportPortal: any;
      totalOpenTransportSD: any;
      totalWhiteGloveTransportSD: any;
      totalWhiteGloveTransportPortal: any;
      totalSuvMarkup: number;
      totalVanMarkup: number;
      totalPickupMarkup: number;
      totalEnclosedMarkup: number;
      totalInoperableMarkup: number;
      totalIrrMakup: number;
      totalFuelMarkup: number;
    };
    7: {
      totalSD: any;
      totalPortal: any;
      name: string;
      days: string;
      totalCompanyTariff: any;
      totalEnclosedTransportPortal: any;
      totalEnclosedTransportSD: any;
      totalOpenTransportPortal: any;
      totalOpenTransportSD: any;
      totalWhiteGloveTransportSD: any;
      totalWhiteGloveTransportPortal: any;
      totalSuvMarkup: number;
      totalVanMarkup: number;
      totalPickupMarkup: number;
      totalEnclosedMarkup: number;
      totalInoperableMarkup: number;
      totalIrrMakup: number;
      totalFuelMarkup: number;
    };
  };
  discount?: number;
  zipModifierAmt?: number;
  modelModifierAmt?: number;
  portalAdminDiscount?: number;
  commission?: number;
  publicAPI?: boolean;
  isCustomerPortal?: boolean;
  expiredAt?: any;
  createdAt?: any;
  updatedAt?: any;
  __v?: number;
}

export class QuoteMigration extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running quote migration UP...");

      // Get source connection (prod database) for reading
      const sourceConnection = this.getSourceConnection();
      const sourceDb = sourceConnection.db;

      // Get destination connection (dev database) for writing
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!sourceDb || !destinationDb) {
        throw new Error("Database connections not available");
      }

      const sourceQuotesCollection = sourceDb.collection("quotes");
      const destinationQuotesCollection = destinationDb.collection("quotes");

      // Count existing documents in source
      const totalQuotes = await sourceQuotesCollection.countDocuments();
      console.log(`📊 Found ${totalQuotes} quotes to migrate from source`);

      if (totalQuotes === 0) {
        return this.createSuccessResult("No quotes found to migrate");
      }

      // Get quotes from source (sorted by createdAt descending - most recent first)
      let cursor = sourceQuotesCollection.find({}).sort({ createdAt: -1 });

      // Apply limit if specified for testing
      if (MAX_QUOTES_TO_PROCESS) {
        cursor = cursor.limit(MAX_QUOTES_TO_PROCESS);
        console.log(
          `🔬 Testing mode: Processing only ${MAX_QUOTES_TO_PROCESS} quotes (most recent first)`,
        );
      } else {
        console.log(
          `🚀 Production mode: Processing ALL quotes (most recent first)`,
        );
      }

      const quotes = await cursor.toArray();

      let migratedCount = 0;
      let errorCount = 0;

      await MigrationUtils.batchProcess(
        quotes as OldQuote[],
        async (quote: OldQuote, index) => {
          try {
            const transformedQuote = this.transformQuote(quote);

            // Check if quote already exists in destination and preserve white glove values
            const existingQuote = await destinationQuotesCollection.findOne({
              _id: quote._id,
            });

            // If quote exists in destination and has white glove pricing, preserve it
            if (existingQuote) {
              const existingWhiteGlove =
                existingQuote.totalPricing?.totals?.whiteGlove;
              const existingVehicleWhiteGlove = existingQuote.vehicles?.map(
                (v: any) => v.pricing?.totals?.whiteGlove || 0,
              );

              // Preserve white glove values if they exist and are greater than 0
              if (existingWhiteGlove && existingWhiteGlove > 0) {
                transformedQuote.totalPricing.totals.whiteGlove =
                  existingWhiteGlove;
              }

              // Preserve vehicle-level white glove values if they exist
              if (
                existingVehicleWhiteGlove &&
                existingVehicleWhiteGlove.length > 0 &&
                transformedQuote.vehicles &&
                transformedQuote.vehicles.length ===
                  existingVehicleWhiteGlove.length
              ) {
                transformedQuote.vehicles.forEach(
                  (vehicle: any, idx: number) => {
                    if (
                      existingVehicleWhiteGlove[idx] &&
                      existingVehicleWhiteGlove[idx] > 0
                    ) {
                      vehicle.pricing.totals.whiteGlove =
                        existingVehicleWhiteGlove[idx];
                    }
                  },
                );
              }
            }

            // Replace or insert the transformed quote into destination database
            // This will overwrite existing quotes with the same _id
            const replaceResult = await destinationQuotesCollection.replaceOne(
              { _id: quote._id },
              transformedQuote,
              { upsert: true },
            );

            if (
              replaceResult.modifiedCount > 0 ||
              replaceResult.upsertedCount > 0
            ) {
              migratedCount++;
              if (index % 10 === 0) {
                console.log(`✅ Migrated ${index + 1}/${quotes.length} quotes`);
              }
            }
          } catch (error) {
            errorCount++;
            console.error(`❌ Error migrating quote ${quote._id}:`, error);
          }
        },
        50, // Process 50 quotes at a time
      );

      const message = `Migration completed. Processed: ${migratedCount} quotes (overwritten existing), Errors: ${errorCount}`;
      return this.createSuccessResult(message, migratedCount);
    } catch (error) {
      return this.createErrorResult(
        "Failed to run quote migration",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async down(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running quote migration DOWN (rollback)...");

      // Get destination connection (dev database) for rollback
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!destinationDb) {
        throw new Error("Destination database connection not available");
      }

      const destinationQuotesCollection = destinationDb.collection("quotes");

      // Remove ALL quotes from destination (since we're doing a full migration)
      const result = await destinationQuotesCollection.deleteMany({});

      return this.createSuccessResult(
        `Rolled back ${result.deletedCount} quotes (cleared destination database)`,
        result.deletedCount,
      );
    } catch (error) {
      return this.createErrorResult(
        "Failed to run migration down",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Convert a value to ObjectId if it's a string, otherwise return as-is
   */
  private convertToObjectId(value: any): any {
    if (!value) return value;
    if (value instanceof Types.ObjectId) return value;
    if (typeof value === "string" && Types.ObjectId.isValid(value)) {
      return new Types.ObjectId(value);
    }
    return value;
  }

  private transformQuote(oldQuote: OldQuote): any {
    const transformedQuote: any = {
      // Preserve existing fields
      _id: oldQuote._id,
      refId: oldQuote.refId || oldQuote.uniqueId,
      status: oldQuote.status.toLowerCase(),
      portalId: this.convertToObjectId(oldQuote.portalId),
      userId: this.convertToObjectId(oldQuote.userId),

      // Transform customer information
      customer: {
        name: oldQuote.customerFullName,
        trackingCode: oldQuote.customerCode,
        email: oldQuote.customerEmail,
      },

      // Transform pickup/delivery to origin/destination format
      origin: {
        userInput: oldQuote.pickupAddressUnformatted?.trim(),
        validated: oldQuote.pickup?.trim(),
        state: this.extractState(oldQuote.pickup),
      },
      destination: {
        userInput: oldQuote.deliveryAddressUnformatted?.trim(),
        validated: oldQuote.delivery?.trim(),
        state: this.extractState(oldQuote.delivery),
      },
      miles: oldQuote.miles,
      transitTime: oldQuote.transitTime || [],
      transportType: oldQuote.transportType.toLowerCase(),
      history: [],
      createdAt: oldQuote.createdAt,
      updatedAt: oldQuote.updatedAt,
      __v: oldQuote.__v || 0,

      // Add new required fields with defaults
      isDirect: oldQuote.isCustomerPortal ? true : false,
      archivedAt: oldQuote.expiredAt,
      migrationVersion: "quote-migration-v2",
    };

    // Transform vehicles from vehicleQuotes
    transformedQuote.vehicles = oldQuote.vehicleQuotes.map((vehicle) =>
      this.transformVehicle(vehicle),
    );

    // Transform totalPricing
    transformedQuote.totalPricing = this.transformTotalPricing(oldQuote);

    return transformedQuote;
  }

  private extractState(location: string): string {
    // Extract state from location string like "Mesa, AZ" -> "AZ"
    const parts = location.split(",");
    if (parts.length > 1) {
      return parts[parts.length - 1].trim();
    }
    return "";
  }

  private transformVehicle(oldVehicle: any): any {
    return {
      make: oldVehicle.make,
      model: oldVehicle.model,
      year: null,
      isInoperable:
        oldVehicle.operable === "inoperable" ||
        oldVehicle.operableBool === false,
      isOversize: this.shouldBeOversize(oldVehicle.pricingClass),
      pricingClass: this.normalizePricingClass(
        oldVehicle.pricingClass,
        oldVehicle.model,
      ),
      pricing: this.transformVehiclePricing(oldVehicle),
    };
  }

  private transformVehiclePricing(oldVehicle: any): any {
    // Check if vehicle has calculatedQuotes data
    if (
      !oldVehicle.calculatedQuotes ||
      oldVehicle.calculatedQuotes.length === 0
    ) {
      // Return empty structure if no calculated quotes data
      return {
        base: 0,
        modifiers: {
          inoperable: 0,
          routes: 0,
          states: 0,
          oversize: 0,
          vehicles: 0,
          globalDiscount: 0,
          portalDiscount: 0,
          irr: 0,
          fuel: 0,
          enclosedFlat: 0,
          enclosedPercent: 0,
          commission: 0,
          serviceLevels: [],
          companyTariffs: [],
        },
        totals: {
          whiteGlove: 0,
          one: {
            open: {
              total: 0,
              companyTariff: 0,
              commission: 0,
              totalWithCompanyTariffAndCommission: 0,
            },
            enclosed: {
              total: 0,
              companyTariff: 0,
              commission: 0,
              totalWithCompanyTariffAndCommission: 0,
            },
          },
          three: {
            total: 0,
            companyTariff: 0,
            commission: 0,
            totalWithCompanyTariffAndCommission: 0,
          },
          five: {
            total: 0,
            companyTariff: 0,
            commission: 0,
            totalWithCompanyTariffAndCommission: 0,
          },
          seven: {
            total: 0,
            companyTariff: 0,
            commission: 0,
            totalWithCompanyTariffAndCommission: 0,
          },
        },
      };
    }

    // Extract modifiers and totals from the calculatedQuotes structure
    const modifiers = this.transformVehicleModifiersFromCalculatedQuotes(
      oldVehicle.calculatedQuotes,
    );
    const totals = this.transformVehicleTotalsFromCalculatedQuotes(
      oldVehicle.calculatedQuotes,
    );

    // Get base from the first calculated quote
    const base = oldVehicle.calculatedQuotes[0]?.baseQuote || 0;

    return {
      base,
      modifiers,
      totals,
    };
  }

  private transformTotalPricing(oldQuote: any): any {
    // Calculate totals by aggregating all vehicles
    const totals = {
      whiteGlove: 0,
      one: {
        open: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
        enclosed: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
      },
      three: {
        open: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
        enclosed: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
      },
      five: {
        open: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
        enclosed: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
      },
      seven: {
        open: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
        enclosed: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
      },
    };

    // Aggregate totals from all vehicles
    if (oldQuote.vehicleQuotes && oldQuote.vehicleQuotes.length > 0) {
      oldQuote.vehicleQuotes.forEach((vehicle: any) => {
        if (vehicle.calculatedQuotes && vehicle.calculatedQuotes.length > 0) {
          // Add whiteGlove total once per vehicle (from first calculated quote)
          totals.whiteGlove +=
            vehicle.calculatedQuotes[0].whiteGloveTransportSD || 0;

          vehicle.calculatedQuotes.forEach((quote: any) => {
            const days = quote.days;
            const openTotalSD = quote.openTransportSD || quote.totalSD || 0;
            const openTotalPortal =
              quote.openTransportPortal || quote.totalPortal || 0;
            const companyTariffOpen =
              quote.companyTariffOpen || quote.companyTariff || 0;
            const companyTariffEnclosed =
              quote.companyTariffEnclosed || quote.companyTariff || 0;
            const commission = quote.commission || 0;
            const enclosedTotalSD = quote.enclosedTransportSD || 0;
            const enclosedTotalPortal = quote.enclosedTransportPortal || 0;

            switch (days) {
              case "1":
                totals.one.open.total += openTotalSD;
                totals.one.open.companyTariff += companyTariffOpen;
                totals.one.open.commission += commission;
                totals.one.open.totalWithCompanyTariffAndCommission +=
                  openTotalPortal;

                totals.one.enclosed.total += enclosedTotalSD;
                totals.one.enclosed.companyTariff += companyTariffEnclosed;
                totals.one.enclosed.commission += commission;
                totals.one.enclosed.totalWithCompanyTariffAndCommission +=
                  enclosedTotalPortal;
                break;
              case "3":
                totals.three.open.total += openTotalSD;
                totals.three.open.companyTariff += companyTariffOpen;
                totals.three.open.commission += commission;
                totals.three.open.totalWithCompanyTariffAndCommission +=
                  openTotalPortal;

                totals.three.enclosed.total += enclosedTotalSD;
                totals.three.enclosed.companyTariff += companyTariffEnclosed;
                totals.three.enclosed.commission += commission;
                totals.three.enclosed.totalWithCompanyTariffAndCommission +=
                  enclosedTotalPortal;
                break;
              case "5":
                totals.five.open.total += openTotalSD;
                totals.five.open.companyTariff += companyTariffOpen;
                totals.five.open.commission += commission;
                totals.five.open.totalWithCompanyTariffAndCommission +=
                  openTotalPortal;

                totals.five.enclosed.total += enclosedTotalSD;
                totals.five.enclosed.companyTariff += companyTariffEnclosed;
                totals.five.enclosed.commission += commission;
                totals.five.enclosed.totalWithCompanyTariffAndCommission +=
                  enclosedTotalPortal;
                break;
              case "7":
                totals.seven.open.total += openTotalSD;
                totals.seven.open.companyTariff += companyTariffOpen;
                totals.seven.open.commission += commission;
                totals.seven.open.totalWithCompanyTariffAndCommission +=
                  openTotalPortal;

                totals.seven.enclosed.total += enclosedTotalSD;
                totals.seven.enclosed.companyTariff += companyTariffEnclosed;
                totals.seven.enclosed.commission += commission;
                totals.seven.enclosed.totalWithCompanyTariffAndCommission +=
                  enclosedTotalPortal;
                break;
            }
          });
        }
      });
    }

    // Calculate base from the first vehicle's first calculated quote
    const base =
      oldQuote.vehicleQuotes?.[0]?.calculatedQuotes?.[0]?.baseQuote || 0;

    // Aggregate modifiers from all vehicles
    const modifiers = this.aggregateVehicleModifiers(
      oldQuote.vehicleQuotes,
      oldQuote,
    );

    return {
      base,
      modifiers,
      totals,
    };
  }

  private aggregateVehicleModifiers(vehicleQuotes: any[], oldQuote?: any): any {
    if (!vehicleQuotes || vehicleQuotes.length === 0) {
      return {
        inoperable: 0,
        routes: oldQuote?.zipModifierAmt || 0, // Set routes from zipModifierAmt
        states: 0,
        oversize: 0,
        vehicles: 0,
        globalDiscount: 0,
        portalDiscount: (oldQuote?.discount || 0) * -1, // Set portalDiscount from discount * -1
        irr: 0,
        fuel: 0,
        enclosedFlat: 0,
        enclosedPercent: 0,
        commission: 0,
        serviceLevels: [],
        companyTariffs: [],
      };
    }

    const aggregated = {
      inoperable: 0,
      routes: oldQuote?.zipModifierAmt || 0, // Set routes from zipModifierAmt
      states: 0,
      oversize: 0,
      vehicles: 0,
      globalDiscount: 0,
      portalDiscount: (oldQuote?.discount || 0) * -1, // Set portalDiscount from discount * -1
      irr: 0,
      fuel: 0,
      enclosedFlat: 0,
      enclosedPercent: 0,
      commission: 0,
      serviceLevels: [] as any[],
      companyTariffs: [] as any[],
    };

    // Aggregate modifiers from all vehicles
    vehicleQuotes.forEach((vehicle, vehicleIndex) => {
      if (vehicle.calculatedQuotes && vehicle.calculatedQuotes.length > 0) {
        const firstQuote = vehicle.calculatedQuotes[0];

        aggregated.inoperable += firstQuote.inoperableMarkup || 0;
        aggregated.irr += firstQuote.irrMakup || 0;
        aggregated.fuel += firstQuote.fuelMarkup || 0;
        aggregated.commission += firstQuote.commission || 0;

        // Add oversize modifier (only one of suvMarkup, vanMarkup, pickupMarkup will have a value)
        aggregated.oversize +=
          (firstQuote.suvMarkup || 0) +
          (firstQuote.vanMarkup || 0) +
          (firstQuote.pickupMarkup || 0);

        // Calculate enclosedFlat for this vehicle
        if (
          firstQuote.enclosedMarkup !== undefined &&
          firstQuote.enclosedModifier !== undefined
        ) {
          aggregated.enclosedFlat += firstQuote.enclosedMarkup || 0;
          aggregated.enclosedPercent += firstQuote.enclosedModifier || 0;
        } else {
          const openTransportPortal = firstQuote.openTransportPortal || 0;
          const enclosedTransportPortal =
            firstQuote.enclosedTransportPortal || 0;
          aggregated.enclosedFlat +=
            enclosedTransportPortal - openTransportPortal;
        }

        // Only add service levels and company tariffs from the first vehicle
        if (vehicleIndex === 0) {
          vehicle.calculatedQuotes.forEach((quote) => {
            aggregated.serviceLevels.push({
              serviceLevelOption: quote.days,
              value: quote.serviceLevelMarkup || 0,
            });

            aggregated.companyTariffs.push({
              serviceLevelOption: quote.days,
              value: quote.companyTariffOpen || quote.companyTariff || 0,
            });
          });
        }
      }
    });

    return aggregated;
  }

  private aggregateTotalPricingModifiers(totalPricing: any): any {
    const serviceLevels = [1, 3, 5, 7];
    const aggregated = {
      inoperable: 0,
      routes: 0,
      states: 0,
      oversize: 0,
      vehicles: 0,
      globalDiscount: 0,
      portalDiscount: 0,
      irr: 0,
      fuel: 0,
      enclosedFlat: 0,
      enclosedPercent: 0,
      commission: 0,
      serviceLevels: [] as any[],
      companyTariffs: [] as any[],
    };

    serviceLevels.forEach((level) => {
      const serviceLevelData = totalPricing[level];
      if (serviceLevelData) {
        aggregated.inoperable += serviceLevelData.totalInoperableMarkup || 0;
        aggregated.irr += serviceLevelData.totalIrrMakup || 0;
        aggregated.fuel += serviceLevelData.totalFuelMarkup || 0;
        aggregated.enclosedFlat += serviceLevelData.totalEnclosedMarkup || 0;

        // Add service level data
        aggregated.serviceLevels.push({
          serviceLevelOption: level.toString(),
          value: 0, // Service level markup not directly available in this structure
        });

        // Add company tariff data
        aggregated.companyTariffs.push({
          serviceLevelOption: level.toString(),
          value: serviceLevelData.totalCompanyTariff?.total || 0,
        });
      }
    });

    return aggregated;
  }

  private transformTotalPricingTotals(totalPricing: any): any {
    const totals = {
      whiteGlove: 0,
      one: {
        open: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
        enclosed: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
      },
      three: {
        total: 0,
        companyTariff: 0,
        commission: 0,
        totalWithCompanyTariffAndCommission: 0,
      },
      five: {
        total: 0,
        companyTariff: 0,
        commission: 0,
        totalWithCompanyTariffAndCommission: 0,
      },
      seven: {
        total: 0,
        companyTariff: 0,
        commission: 0,
        totalWithCompanyTariffAndCommission: 0,
      },
    };

    // Transform each service level
    [1, 3, 5, 7].forEach((level) => {
      const serviceLevelData = totalPricing[level];
      if (serviceLevelData) {
        const totalPortal = serviceLevelData.totalPortal || 0;
        const companyTariff = serviceLevelData.totalCompanyTariff || 0;
        const commission = 0; // Not directly available in this structure
        const totalWithCompanyTariffAndCommission =
          totalPortal + companyTariff + commission;

        switch (level) {
          case 1:
            totals.one.open.total =
              serviceLevelData.totalOpenTransportPortal || totalPortal;
            totals.one.open.companyTariff = companyTariff;
            totals.one.open.commission = commission;
            totals.one.open.totalWithCompanyTariffAndCommission =
              totals.one.open.total + companyTariff + commission;

            totals.one.enclosed.total =
              serviceLevelData.totalEnclosedTransportPortal || totalPortal;
            totals.one.enclosed.companyTariff = companyTariff;
            totals.one.enclosed.commission = commission;
            totals.one.enclosed.totalWithCompanyTariffAndCommission =
              totals.one.enclosed.total + companyTariff + commission;
            break;
          case 3:
            totals.three.total = totalPortal;
            totals.three.companyTariff = companyTariff;
            totals.three.commission = commission;
            totals.three.totalWithCompanyTariffAndCommission =
              totalWithCompanyTariffAndCommission;
            break;
          case 5:
            totals.five.total = totalPortal;
            totals.five.companyTariff = companyTariff;
            totals.five.commission = commission;
            totals.five.totalWithCompanyTariffAndCommission =
              totalWithCompanyTariffAndCommission;
            break;
          case 7:
            totals.seven.total = totalPortal;
            totals.seven.companyTariff = companyTariff;
            totals.seven.commission = commission;
            totals.seven.totalWithCompanyTariffAndCommission =
              totalWithCompanyTariffAndCommission;
            break;
        }
      }
    });

    return totals;
  }

  private shouldBeOversize(pricingClass: string): boolean {
    if (!pricingClass) return false;

    const lowerPricingClass = pricingClass.toLowerCase();

    // Check if pricing class is suv, van, or pickup
    return (
      lowerPricingClass === "suv" ||
      lowerPricingClass === "van" ||
      lowerPricingClass.includes("pickup")
    );
  }

  private normalizePricingClass(pricingClass: string, model?: string): string {
    if (!pricingClass) return "sedan";

    const lowerPricingClass = pricingClass.toLowerCase();
    const lowerModel = model?.toLowerCase() || "";

    // If model contains "sedan", definitely set as sedan
    if (lowerModel.includes("sedan")) {
      return "sedan";
    }

    // Map to the correct enum values
    switch (lowerPricingClass) {
      case "sedan":
        return "sedan";
      case "suv":
        return "suv";
      case "van":
        return "van";
      case "pickup":
      case "pickup truck":
      case "pickup_4_doors":
      case "pickup_2_doors":
        // Default to 4-door pickup for generic "pickup"
        return "pickup_4_doors";
      default:
        // Default to sedan for unknown types
        return "sedan";
    }
  }

  private transformVehicleModifiersFromCalculatedQuotes(
    calculatedQuotes: any[],
  ): any {
    if (!calculatedQuotes || calculatedQuotes.length === 0) {
      return {
        inoperable: 0,
        routes: 0,
        states: 0,
        oversize: 0,
        vehicles: 0,
        globalDiscount: 0,
        portalDiscount: 0,
        irr: 0,
        fuel: 0,
        enclosedFlat: 0,
        enclosedPercent: 0,
        commission: 0,
        serviceLevels: [],
        companyTariffs: [],
      };
    }

    // Get the first calculated quote to extract base modifiers
    const firstQuote = calculatedQuotes[0];

    // Calculate enclosedFlat and enclosedPercent based on available data
    let enclosedFlat = 0;
    let enclosedPercent = 0;

    // Check if both enclosedMarkup and enclosedModifier exist
    if (
      firstQuote.enclosedMarkup !== undefined &&
      firstQuote.enclosedModifier !== undefined
    ) {
      // Use the existing values directly
      enclosedFlat = firstQuote.enclosedMarkup || 0;
      enclosedPercent = firstQuote.enclosedModifier || 0;
    } else {
      // Calculate enclosedFlat by subtracting openTransportPortal from enclosedTransportPortal
      const openTransportPortal = firstQuote.openTransportPortal || 0;
      const enclosedTransportPortal = firstQuote.enclosedTransportPortal || 0;
      enclosedFlat = enclosedTransportPortal - openTransportPortal;
    }

    // Extract service levels from all calculated quotes
    const serviceLevels = calculatedQuotes.map((quote) => ({
      serviceLevelOption: quote.days,
      value: quote.serviceLevelMarkup || 0,
    }));

    // Extract company tariffs from all calculated quotes (use companyTariffOpen)
    const companyTariffs = calculatedQuotes.map((quote) => ({
      serviceLevelOption: quote.days,
      value: quote.companyTariffOpen || quote.companyTariff || 0,
    }));

    // Calculate oversize modifier (only one of suvMarkup, vanMarkup, pickupMarkup will have a value)
    const oversize =
      (firstQuote.suvMarkup || 0) +
      (firstQuote.vanMarkup || 0) +
      (firstQuote.pickupMarkup || 0);

    return {
      inoperable: firstQuote.inoperableMarkup || 0,
      routes: 0, // Will be set from zipModifierAmt at quote level
      states: 0, // Not available in calculatedQuotes structure
      oversize,
      vehicles: 0, // Not available in calculatedQuotes structure
      globalDiscount: firstQuote.totalDiscount || 0,
      portalDiscount: 0, // Not available in calculatedQuotes structure
      irr: firstQuote.irrMakup || 0, // Note: typo in source field name
      fuel: firstQuote.fuelMarkup || 0,
      enclosedFlat,
      enclosedPercent,
      commission: firstQuote.commission || 0,
      serviceLevels,
      companyTariffs,
    };
  }

  private transformVehicleTotalsFromCalculatedQuotes(
    calculatedQuotes: any[],
  ): any {
    if (!calculatedQuotes || calculatedQuotes.length === 0) {
      return {
        whiteGlove: 0,
        one: {
          open: {
            total: 0,
            companyTariff: 0,
            commission: 0,
            totalWithCompanyTariffAndCommission: 0,
          },
          enclosed: {
            total: 0,
            companyTariff: 0,
            commission: 0,
            totalWithCompanyTariffAndCommission: 0,
          },
        },
        three: {
          open: {
            total: 0,
            companyTariff: 0,
            commission: 0,
            totalWithCompanyTariffAndCommission: 0,
          },
          enclosed: {
            total: 0,
            companyTariff: 0,
            commission: 0,
            totalWithCompanyTariffAndCommission: 0,
          },
        },
        five: {
          open: {
            total: 0,
            companyTariff: 0,
            commission: 0,
            totalWithCompanyTariffAndCommission: 0,
          },
          enclosed: {
            total: 0,
            companyTariff: 0,
            commission: 0,
            totalWithCompanyTariffAndCommission: 0,
          },
        },
        seven: {
          open: {
            total: 0,
            companyTariff: 0,
            commission: 0,
            totalWithCompanyTariffAndCommission: 0,
          },
          enclosed: {
            total: 0,
            companyTariff: 0,
            commission: 0,
            totalWithCompanyTariffAndCommission: 0,
          },
        },
      };
    }

    // Initialize totals structure
    const totals = {
      whiteGlove: 0,
      one: {
        open: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
        enclosed: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
      },
      three: {
        open: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
        enclosed: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
      },
      five: {
        open: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
        enclosed: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
      },
      seven: {
        open: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
        enclosed: {
          total: 0,
          companyTariff: 0,
          commission: 0,
          totalWithCompanyTariffAndCommission: 0,
        },
      },
    };

    // Set whiteGlove value from the first calculated quote
    if (calculatedQuotes.length > 0) {
      totals.whiteGlove = calculatedQuotes[0].whiteGloveTransportSD || 0;
    }

    // Map calculated quotes to totals structure
    calculatedQuotes.forEach((quote) => {
      // Handle both string and number formats for days
      // Try days first, then serviceLevelOption as fallback
      const daysRaw = quote.days ?? quote.serviceLevelOption ?? null;
      if (daysRaw === null) {
        console.warn(`⚠️  Quote missing days/serviceLevelOption:`, quote);
        return;
      }

      // Normalize to string for consistent comparison
      const days = String(daysRaw).trim();
      
      const openTotalSD = quote.openTransportSD || quote.totalSD || 0;
      const openTotalPortal =
        quote.openTransportPortal || quote.totalPortal || 0;
      const companyTariffOpen =
        quote.companyTariffOpen || quote.companyTariff || 0;
      const companyTariffEnclosed =
        quote.companyTariffEnclosed || quote.companyTariff || 0;
      const commission = quote.commission || 0;
      const enclosedTotalSD = quote.enclosedTransportSD || 0;
      const enclosedTotalPortal = quote.enclosedTransportPortal || 0;

      // Compare as string after normalization
      if (days === "1") {
        totals.one.open.total = openTotalSD;
        totals.one.open.companyTariff = companyTariffOpen;
        totals.one.open.commission = commission;
        totals.one.open.totalWithCompanyTariffAndCommission = openTotalPortal;

        totals.one.enclosed.total = enclosedTotalSD;
        totals.one.enclosed.companyTariff = companyTariffEnclosed;
        totals.one.enclosed.commission = commission;
        totals.one.enclosed.totalWithCompanyTariffAndCommission =
          enclosedTotalPortal;
      } else if (days === "3") {
        totals.three.open.total = openTotalSD;
        totals.three.open.companyTariff = companyTariffOpen;
        totals.three.open.commission = commission;
        totals.three.open.totalWithCompanyTariffAndCommission =
          openTotalPortal;

        totals.three.enclosed.total = enclosedTotalSD;
        totals.three.enclosed.companyTariff = companyTariffEnclosed;
        totals.three.enclosed.commission = commission;
        totals.three.enclosed.totalWithCompanyTariffAndCommission =
          enclosedTotalPortal;
      } else if (days === "5") {
        totals.five.open.total = openTotalSD;
        totals.five.open.companyTariff = companyTariffOpen;
        totals.five.open.commission = commission;
        totals.five.open.totalWithCompanyTariffAndCommission =
          openTotalPortal;

        totals.five.enclosed.total = enclosedTotalSD;
        totals.five.enclosed.companyTariff = companyTariffEnclosed;
        totals.five.enclosed.commission = commission;
        totals.five.enclosed.totalWithCompanyTariffAndCommission =
          enclosedTotalPortal;
      } else if (days === "7") {
        totals.seven.open.total = openTotalSD;
        totals.seven.open.companyTariff = companyTariffOpen;
        totals.seven.open.commission = commission;
        totals.seven.open.totalWithCompanyTariffAndCommission =
          openTotalPortal;

        totals.seven.enclosed.total = enclosedTotalSD;
        totals.seven.enclosed.companyTariff = companyTariffEnclosed;
        totals.seven.enclosed.commission = commission;
        totals.seven.enclosed.totalWithCompanyTariffAndCommission =
          enclosedTotalPortal;
      } else {
        // Log if we encounter an unexpected days value for debugging
        console.warn(`⚠️  Unexpected days value in calculatedQuotes: "${days}" (raw: ${daysRaw}, type: ${typeof daysRaw})`);
        console.warn(`   Quote data:`, JSON.stringify(quote, null, 2));
      }
    });

    // Debug: Log if totals are still zero for 3/5/7-day
    if (calculatedQuotes.length > 0) {
      const hasThreeDay = calculatedQuotes.some(q => String(q.days).trim() === "3");
      const hasFiveDay = calculatedQuotes.some(q => String(q.days).trim() === "5");
      const hasSevenDay = calculatedQuotes.some(q => String(q.days).trim() === "7");
      
      if (hasThreeDay && totals.three.open.total === 0) {
        console.warn(`⚠️  3-day data exists in calculatedQuotes but totals.three.open.total is still 0`);
      }
      if (hasFiveDay && totals.five.open.total === 0) {
        console.warn(`⚠️  5-day data exists in calculatedQuotes but totals.five.open.total is still 0`);
      }
      if (hasSevenDay && totals.seven.open.total === 0) {
        console.warn(`⚠️  7-day data exists in calculatedQuotes but totals.seven.open.total is still 0`);
      }
    }

    return totals;
  }
}

// Run the migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new QuoteMigration();

  const direction = process.argv[2] === "down" ? "down" : "up";

  migration
    .run(direction)
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("💥 Migration execution failed:", error);
      process.exit(1);
    });
}
