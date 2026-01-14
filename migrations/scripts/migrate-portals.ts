import mongoose from "mongoose";
import {
  MigrationBase,
  MigrationResult,
  MigrationUtils,
} from "../utils/migration-base";

// Configuration constants
// Set to null or undefined to process all portals
// Set to a number to limit processing (useful for testing)
const MAX_PORTALS_TO_PROCESS: number | null = null; // Process all portals

/**
 * Portal Migration Script
 *
 * This migration transforms portals from the old format to the new schema structure.
 * Key transformations:
 * - Maps old portal fields to new portal schema
 * - Transforms custom rates from old format to new format
 * - Maps status values to new enum values
 * - Transforms options and settings to new structure
 *
 * IMPORTANT: This migration processes portals from the source database and
 * overwrites any existing portals in the destination database with the same _id.
 *
 * Testing vs Production:
 * - Set MAX_PORTALS_TO_PROCESS = 15 (or any number) for testing with limited portals
 * - Set MAX_PORTALS_TO_PROCESS = null to process ALL portals in production
 *
 * To run this migration:
 * 1. Set your MongoDB connection strings:
 *    export MIGRATION_SOURCE_URI="mongodb://localhost:27017/source-database"
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/migrate-portals.ts
 *
 * IMPORTANT: This migration ensures:
 * - _id is always an ObjectId (not a string)
 * - refId field is never included (portals don't have refId)
 * - parentPortalId is converted to ObjectId if it's a string
 */

interface OldPortal {
  _id: any;
  companyName: string;
  contactFullName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactMobilePhone?: string;
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyZip?: string;
  companyLogo?: string;
  status?: string;
  displayMCLogo?: boolean;
  hasCustomRates?: boolean;
  hasVariableCompanyTariff?: boolean;
  hasWhiteGloveOverride?: boolean;
  allowsCustomerTracking?: boolean;
  displayAgent?: boolean;
  locationTypeIsRequired?: boolean;
  displayPortalCommission?: boolean;
  displayCommissionPerVehicle?: boolean;
  displayPDFTotalPriceOnly?: boolean;
  displayPaymentType?: boolean;
  displayDiscountOption?: boolean;
  portalQuoteExpirationDays?: number;
  parentPortal?: any;
  isDealership?: boolean;
  disableAgentNotifications?: boolean;
  customRates?: {
    mileage?: Record<string, number>;
    largeClassSurcharge?: number;
    suvClassSurcharge?: number;
    vanClassSurcharge?: number;
    pickUp4DoorClassSurcharge?: number;
    enclosedSurcharge?: number;
    enclosedSurchargeOver1500?: number;
    fuelSurcharge?: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
  // Explicitly exclude refId - portals should NEVER have refId
  refId?: never;
}

interface ICustomRate {
  value: number;
  label: string;
  min: number;
  max: number;
}

export class PortalMigration extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running portal migration UP...");

      // Get source connection (prod database) for reading
      console.log("📡 Getting source connection...");
      const sourceConnection = this.getSourceConnection();
      const sourceDb = sourceConnection.db;

      // Get destination connection (dev database) for writing
      console.log("📡 Getting destination connection...");
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!sourceDb || !destinationDb) {
        throw new Error("Database connections not available");
      }

      console.log("📋 Accessing collections...");
      const sourcePortalsCollection = sourceDb.collection("portals");
      const destinationPortalsCollection = destinationDb.collection("portals");

      // Count existing documents in source
      console.log("🔍 Counting portals in source database...");
      const totalPortals = await sourcePortalsCollection.countDocuments();
      console.log(`📦 Found ${totalPortals} portals in source database`);

      if (totalPortals === 0) {
        return {
          success: true,
          message: "No portals found to migrate",
          recordsAffected: 0,
        };
      }

      // Apply limit if specified
      const limit = MAX_PORTALS_TO_PROCESS || totalPortals;
      console.log(
        `📊 Processing ${limit} portals (limit: ${MAX_PORTALS_TO_PROCESS || "none"})`,
      );

      // Get portals from source database (sorted by createdAt descending - most recent first)
      const portals = await sourcePortalsCollection
        .find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      console.log(`📦 Retrieved ${portals.length} portals to migrate`);

      if (portals.length === 0) {
        return {
          success: true,
          message: "No portals found to migrate",
          recordsAffected: 0,
        };
      }

      // Process portals in batches
      let migratedCount = 0;
      let errorCount = 0;

      await MigrationUtils.batchProcess(
        portals as OldPortal[],
        async (portal: OldPortal, index) => {
          try {
            // Transform portal to new structure
            const transformedPortal = this.transformPortal(portal);

            // Use the transformed portal directly - it already has the correct structure
            // and explicitly excludes refId (refId is never in the transformPortal return)
            const cleanPortal = transformedPortal;

            // Replace or insert the transformed portal into destination database
            // This will overwrite existing portals with the same _id
            const replaceResult = await destinationPortalsCollection.replaceOne(
              { _id: cleanPortal._id },
              cleanPortal,
              { upsert: true },
            );

            if (replaceResult.acknowledged) {
              migratedCount++;
              if (migratedCount % 10 === 0 || migratedCount === 1) {
                console.log(
                  `📊 Processed ${migratedCount}/${portals.length} portals (${replaceResult.modifiedCount} updated, ${replaceResult.upsertedCount} inserted)`,
                );
              }
            } else {
              console.error(`❌ Failed to save portal ${portal._id} - operation not acknowledged`);
              errorCount++;
            }
          } catch (error) {
            console.error(`❌ Error processing portal ${portal._id}:`, error);
            errorCount++;
          }
        },
        10, // batchSize
      );

      console.log(
        `✅ Portal migration completed: ${migratedCount} successful, ${errorCount} errors`,
      );

      return {
        success: true,
        message: `Successfully processed ${portals.length} portals (${migratedCount} successful, ${errorCount} errors)`,
        recordsAffected: migratedCount,
      };
    } catch (error) {
      console.error("❌ Portal migration failed:", error);
      throw error;
    }
  }

  async down(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running portal migration DOWN...");

      // Get destination connection (dev database) for deletion
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!destinationDb) {
        throw new Error("Destination database connection not available");
      }

      const destinationPortalsCollection = destinationDb.collection("portals");

      // Count existing documents in destination
      const totalPortals = await destinationPortalsCollection.countDocuments();
      console.log(`📦 Found ${totalPortals} portals in destination database`);

      if (totalPortals === 0) {
        return {
          success: true,
          message: "No portals found to rollback",
          recordsAffected: 0,
        };
      }

      // Delete all portals
      const deleteResult = await destinationPortalsCollection.deleteMany({});

      console.log(
        `✅ Rollback completed: deleted ${deleteResult.deletedCount} portals`,
      );

      return {
        success: true,
        message: `Successfully deleted ${deleteResult.deletedCount} portals`,
        recordsAffected: deleteResult.deletedCount,
      };
    } catch (error) {
      console.error("❌ Portal rollback failed:", error);
      throw error;
    }
  }

  private transformPortal(portal: OldPortal): any {
    // Map old status to new enum values
    const statusMapping: Record<string, string> = {
      active: "active",
      complete: "complete",
      disabled: "disabled",
      archived: "archived",
      expired: "expired",
      booked: "booked",
    };

    // Determine the new status
    const status =
      statusMapping[portal.status?.toLowerCase() || ""] || "active";

    // Transform custom rates from old format to new format
    const customRates: ICustomRate[] = [];

    // Only process custom rates if they actually exist and have meaningful values
    if (portal.customRates && portal.hasCustomRates) {
      console.log(
        `🔍 Portal ${portal._id} has customRates:`,
        JSON.stringify(portal.customRates, null, 2),
      );
      console.log(
        `🔍 Portal ${portal._id} hasCustomRates flag:`,
        portal.hasCustomRates,
      );
      // Convert mileage-based custom rates to new format
      const mileageRates = portal.customRates.mileage || {};
      Object.entries(mileageRates).forEach(([range, value]) => {
        if (value && value > 0) {
          const [min, max] = range.split("-").map(Number);
          customRates.push({
            label: `${range} miles`,
            min: min || 0,
            max: max || min,
            value: value,
          });
        }
      });

      // Add class surcharges as custom rates (only if they have meaningful values)
      if (
        portal.customRates.largeClassSurcharge &&
        portal.customRates.largeClassSurcharge > 0
      ) {
        customRates.push({
          label: "Large Class Surcharge",
          min: 0,
          max: 0,
          value: portal.customRates.largeClassSurcharge,
        });
      }
      if (
        portal.customRates.suvClassSurcharge &&
        portal.customRates.suvClassSurcharge > 0
      ) {
        customRates.push({
          label: "SUV Class Surcharge",
          min: 0,
          max: 0,
          value: portal.customRates.suvClassSurcharge,
        });
      }
      if (
        portal.customRates.vanClassSurcharge &&
        portal.customRates.vanClassSurcharge > 0
      ) {
        customRates.push({
          label: "Van Class Surcharge",
          min: 0,
          max: 0,
          value: portal.customRates.vanClassSurcharge,
        });
      }
      if (
        portal.customRates.pickUp4DoorClassSurcharge &&
        portal.customRates.pickUp4DoorClassSurcharge > 0
      ) {
        customRates.push({
          label: "Pickup 4-Door Class Surcharge",
          min: 0,
          max: 0,
          value: portal.customRates.pickUp4DoorClassSurcharge,
        });
      }
      if (
        portal.customRates.enclosedSurcharge &&
        portal.customRates.enclosedSurcharge > 0
      ) {
        customRates.push({
          label: "Enclosed Surcharge",
          min: 0,
          max: 0,
          value: portal.customRates.enclosedSurcharge,
        });
      }
      if (
        portal.customRates.enclosedSurchargeOver1500 &&
        portal.customRates.enclosedSurchargeOver1500 > 0
      ) {
        customRates.push({
          label: "Enclosed Surcharge Over 1500",
          min: 1500,
          max: 999999,
          value: portal.customRates.enclosedSurchargeOver1500,
        });
      }
      if (
        portal.customRates.fuelSurcharge &&
        portal.customRates.fuelSurcharge > 0
      ) {
        customRates.push({
          label: "Fuel Surcharge",
          min: 0,
          max: 0,
          value: portal.customRates.fuelSurcharge,
        });
      }
    }

    // Debug logging for custom rates
    if (customRates.length > 0) {
      console.log(
        `🔍 Portal ${portal._id} created ${customRates.length} custom rates:`,
        customRates,
      );
    } else {
      console.log(`🔍 Portal ${portal._id} has no custom rates`);
    }

    // Ensure _id is an ObjectId, not a string
    let portalId = portal._id;
    if (typeof portalId === "string") {
      // If it's a valid ObjectId string, convert it
      if (mongoose.Types.ObjectId.isValid(portalId)) {
        portalId = new mongoose.Types.ObjectId(portalId);
      } else {
        console.warn(
          `⚠️  Portal ${portalId} has invalid _id format, using as-is`,
        );
      }
    }

    // Build portal object - explicitly include only allowed fields
    // CRITICAL: refId is NEVER included - portals don't have refId
    return {
      _id: portalId,
      status: status,
      companyName: portal.companyName,
      contact: {
        name: portal.contactFullName || null,
        email: portal.contactEmail || null,
        phone: portal.contactPhone || null,
        phoneMobile: portal.contactMobilePhone || null,
        notes: null,
      },
      address: {
        address: portal.companyAddress || null,
        addressLine2: null,
        city: portal.companyCity || null,
        state: portal.companyState || null,
        zip: portal.companyZip || null,
      },
      logo: portal.companyLogo || null,
      isDealership: portal.isDealership || false,
      disableAgentNotifications: portal.disableAgentNotifications || false,
      options: {
        overrideLogo: portal.displayMCLogo === false, // Inverted logic
        enableCustomRates: portal.hasCustomRates || false,
        enableVariableCompanyTariff: portal.hasVariableCompanyTariff || false,
        enableWhiteGloveOverride: portal.hasWhiteGloveOverride || false,
        enableOrderTrackingByCustomer: portal.allowsCustomerTracking !== false,
        enableSurvey: true,
        portalAdmin: {
          enableDiscount: portal.displayDiscountOption !== false,
        },
        quoteDetail: {
          displayCompanyTariff: true,
          displayCommission: portal.displayPortalCommission,
        },
        orderForm: {
          enableAgent: portal.displayAgent !== false,
          defaultPaymentType:
            portal.displayPaymentType === false ? "cod" : null,
          requireLocationType: portal.locationTypeIsRequired || false,
        },
        quoteForm: {
          enableCommissionPerVehicle:
            portal.displayCommissionPerVehicle !== false,
          enableCommission: true, // Default to true
        },
        orderPDF: {
          enablePriceBreakdown: !portal.displayPDFTotalPriceOnly,
        },
        quoteExpiryDays: portal.portalQuoteExpirationDays || 30,
      },
      parentPortalId: portal.parentPortal 
        ? (typeof portal.parentPortal === 'string' && mongoose.Types.ObjectId.isValid(portal.parentPortal)
            ? new mongoose.Types.ObjectId(portal.parentPortal)
            : portal.parentPortal instanceof mongoose.Types.ObjectId
            ? portal.parentPortal
            : null)
        : null,
      customRates: customRates,
      createdAt: portal.createdAt || new Date(),
      updatedAt: new Date(), // Always use current time
    };
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new PortalMigration();

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
