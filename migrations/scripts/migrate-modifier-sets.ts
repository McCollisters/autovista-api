import {
  MigrationBase,
  MigrationResult,
  MigrationUtils,
} from "../utils/migration-base";

// Configuration constants
const MAX_MODIFIER_SETS_TO_PROCESS = 50; // Set to null or undefined to process all modifier sets

/**
 * Modifier Set Migration Script
 *
 * This migration transforms portals from the old format to new modifier set structure.
 * Key transformations:
 * - Extracts modifier values from portal custom rates
 * - Creates modifier sets for each portal
 * - Maps old portal fields to new modifier set schema
 * - Handles global, portal, and conditional modifiers
 *
 * IMPORTANT: This migration processes portals from the source database and
 * creates modifier sets in the destination database.
 *
 * Testing vs Production:
 * - Set MAX_MODIFIER_SETS_TO_PROCESS = 15 (or any number) for testing with limited modifier sets
 * - Set MAX_MODIFIER_SETS_TO_PROCESS = null to process ALL modifier sets in production
 *
 * To run this migration:
 * 1. Set your MongoDB connection strings:
 *    export MIGRATION_SOURCE_URI="mongodb://localhost:27017/source-database"
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/migrate-modifier-sets.ts
 */

interface OldPortal {
  _id: any;
  companyName: string;
  discount?: number;
  portalCommission?: number;
  companyTariff?: number;
  portalAdminDiscount?: number;
  hasVariableCompanyTariff?: boolean;
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
}

interface OldSettings {
  _id: any;
  enclosedMarkup?: number;
  enclosedModifier?: number;
  inoperableMarkup?: number;
  whiteGloveModifier?: number;
  whiteGloveMinimum?: number;
  serviceLevels?: Array<{
    name: string;
    value: string;
    markup: number;
  }>;
  stateModifiers?: Array<{
    state: string;
    type: string;
    direction: string;
    amount: number | string;
  }>;
  stateToStateModifiers?: Array<{
    fromState: string;
    toState: string;
    type: string;
    amount: number;
  }>;
  updatedAt?: Date;
}

interface IModifier {
  value: number;
  valueType: string;
}

interface IServiceLevelModifier {
  serviceLevelOption: string;
  value: number;
}

export class ModifierSetMigration extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running modifier set migration UP...");

      // Get source connection (prod database) for reading
      const sourceConnection = this.getSourceConnection();
      const sourceDb = sourceConnection.db;

      // Get destination connection (dev database) for writing
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!sourceDb || !destinationDb) {
        throw new Error("Database connections not available");
      }

      const sourcePortalsCollection = sourceDb.collection("portals");
      const destinationModifierSetsCollection =
        destinationDb.collection("modifiersets");

      // Count existing documents in source
      const totalPortals = await sourcePortalsCollection.countDocuments();
      console.log(`📦 Found ${totalPortals} portals in source database`);

      if (totalPortals === 0) {
        return {
          success: true,
          message: "No portals found to create modifier sets for",
          recordsAffected: 0,
        };
      }

      // Apply limit if specified
      const limit = MAX_MODIFIER_SETS_TO_PROCESS || totalPortals;
      console.log(
        `📊 Processing ${limit} modifier sets (limit: ${MAX_MODIFIER_SETS_TO_PROCESS || "none"})`,
      );

      // Get portals from source database (sorted by createdAt descending - most recent first)
      const portals = await sourcePortalsCollection
        .find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      console.log(
        `📦 Retrieved ${portals.length} portals to create modifier sets for`,
      );

      if (portals.length === 0) {
        return {
          success: true,
          message: "No portals found to create modifier sets for",
          recordsAffected: 0,
        };
      }

      // Process modifier sets in batches
      let migratedCount = 0;
      let errorCount = 0;

      await MigrationUtils.batchProcess(
        portals as OldPortal[],
        async (portal: OldPortal, index) => {
          try {
            const transformedModifierSet =
              this.transformPortalToModifierSet(portal);

            // Insert the transformed modifier set into destination database
            const insertResult =
              await destinationModifierSetsCollection.insertOne(
                transformedModifierSet,
              );

            if (insertResult.acknowledged) {
              migratedCount++;
              if (index % 10 === 0) {
                console.log(
                  `📊 Processed ${index + 1}/${portals.length} modifier sets`,
                );
              }
            } else {
              console.error(
                `❌ Failed to save modifier set for portal ${portal._id}`,
              );
              errorCount++;
            }
          } catch (error) {
            console.error(
              `❌ Error processing modifier set for portal ${portal._id}:`,
              error,
            );
            errorCount++;
          }
        },
        10, // batchSize
      );

      // Create global modifier set from Settings collection
      console.log(
        "🌍 Creating global modifier set from Settings collection...",
      );

      const sourceSettingsCollection = sourceDb.collection("settings");
      const settings = await sourceSettingsCollection.findOne({});

      if (settings) {
        try {
          const globalModifierSet =
            this.transformSettingsToGlobalModifierSet(settings);
          const globalInsertResult =
            await destinationModifierSetsCollection.insertOne(
              globalModifierSet,
            );

          if (globalInsertResult.acknowledged) {
            migratedCount++;
            console.log("✅ Global modifier set created successfully");
          } else {
            console.error("❌ Failed to save global modifier set");
            errorCount++;
          }
        } catch (error) {
          console.error("❌ Error creating global modifier set:", error);
          errorCount++;
        }
      } else {
        console.log(
          "⚠️ No settings found in source database, skipping global modifier set creation",
        );
      }

      console.log(
        `✅ Modifier set migration completed: ${migratedCount} successful, ${errorCount} errors`,
      );

      return {
        success: true,
        message: `Successfully processed ${portals.length} modifier sets + 1 global modifier set (${migratedCount} successful, ${errorCount} errors)`,
        recordsAffected: migratedCount,
      };
    } catch (error) {
      console.error("❌ Modifier set migration failed:", error);
      throw error;
    }
  }

  async down(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running modifier set migration DOWN...");

      // Get destination connection (dev database) for deletion
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!destinationDb) {
        throw new Error("Destination database connection not available");
      }

      const destinationModifierSetsCollection =
        destinationDb.collection("modifiersets");

      // Count existing documents in destination
      const totalModifierSets =
        await destinationModifierSetsCollection.countDocuments();
      console.log(
        `📦 Found ${totalModifierSets} modifier sets in destination database`,
      );

      if (totalModifierSets === 0) {
        return {
          success: true,
          message: "No modifier sets found to rollback",
          recordsAffected: 0,
        };
      }

      // Delete all modifier sets
      const deleteResult = await destinationModifierSetsCollection.deleteMany(
        {},
      );

      console.log(
        `✅ Rollback completed: deleted ${deleteResult.deletedCount} modifier sets`,
      );

      return {
        success: true,
        message: `Successfully deleted ${deleteResult.deletedCount} modifier sets`,
        recordsAffected: deleteResult.deletedCount,
      };
    } catch (error) {
      console.error("❌ Modifier set rollback failed:", error);
      throw error;
    }
  }

  private transformPortalToModifierSet(portal: OldPortal): any {
    // Extract modifier values from portal
    const inoperable: IModifier = {
      value: 0, // Default value - could be calculated from custom rates
      valueType: "flat",
    };

    const fuel: IModifier = {
      value: portal.customRates?.fuelSurcharge || 0,
      valueType: "flat",
    };

    const irr: IModifier = {
      value: 0, // Default value - could be calculated from custom rates
      valueType: "flat",
    };

    const whiteGlove = {
      multiplier: 2,
      minimum: 1200,
    };

    const oversize = {
      suv: portal.customRates?.suvClassSurcharge || 0,
      van: portal.customRates?.vanClassSurcharge || 0,
      pickup_2_doors:
        (portal.customRates?.pickUp4DoorClassSurcharge || 0) > 0
          ? portal.customRates?.pickUp4DoorClassSurcharge || 0
          : 0,
      pickup_4_doors: portal.customRates?.pickUp4DoorClassSurcharge || 0,
    };

    const enclosedFlat: IModifier = {
      value: portal.customRates?.enclosedSurcharge || 0,
      valueType: "flat",
    };

    const enclosedPercent: IModifier = {
      value: 0, // Default value
      valueType: "flat",
    };

    const discount: IModifier = {
      value: portal.discount || 0,
      valueType: "flat",
    };

    const companyTariff: IModifier = {
      value: portal.companyTariff || 0,
      valueType: "flat",
    };

    const companyTariffDiscount: IModifier = {
      value: portal.portalAdminDiscount || 0,
      valueType: "flat",
    };

    const companyTariffEnclosedFee: IModifier = {
      value:
        portal.hasVariableCompanyTariff === false
          ? 0
          : portal.customRates?.enclosedSurchargeOver1500 || 0,
      valueType: "flat",
    };

    const fixedCommission: IModifier = {
      value: portal.portalCommission || 0,
      valueType: "flat",
    };

    // Default service levels
    const serviceLevels: IServiceLevelModifier[] = [
      {
        serviceLevelOption: "1",
        value: 175, // Default value - could be calculated from custom rates
      },
      {
        serviceLevelOption: "3",
        value: 125, // Default value - could be calculated from custom rates
      },
      {
        serviceLevelOption: "5",
        value: 100, // Default value - could be calculated from custom rates
      },
      {
        serviceLevelOption: "7",
        value: 75, // Default value - could be calculated from custom rates
      },
    ];

    return {
      portalId: portal._id, // Reference to original portal
      isGlobal: false, // Portal-specific modifier sets
      inoperable,
      fuel,
      irr,
      whiteGlove,
      oversize,
      enclosedFlat,
      enclosedPercent,
      discount,
      companyTariff,
      companyTariffDiscount,
      companyTariffEnclosedFee,
      fixedCommission,
      states: new Map(), // Empty map for now
      routes: [], // Empty array for now
      zips: [], // Empty array for now
      vehicles: [], // Empty array for now
      serviceLevels,
      createdAt: portal.createdAt || new Date(),
      updatedAt: portal.updatedAt || new Date(),
    };
  }

  private transformSettingsToGlobalModifierSet(settings: OldSettings): any {
    // Extract modifier values from settings
    const inoperable: IModifier = {
      value: settings.inoperableMarkup || 0,
      valueType: "flat",
    };

    const fuel: IModifier = {
      value: 0, // Default value - no fuel surcharge in global settings
      valueType: "flat",
    };

    const irr: IModifier = {
      value: 0, // Default value - no IRR in global settings
      valueType: "flat",
    };

    const whiteGlove = {
      multiplier: settings.whiteGloveModifier || 2,
      minimum: settings.whiteGloveMinimum || 1500,
    };

    const oversize = {
      suv: 0, // Default values for global modifier set
      van: 0,
      pickup_2_doors: 0,
      pickup_4_doors: 0,
    };

    const enclosedFlat: IModifier = {
      value: settings.enclosedMarkup || 0,
      valueType: "flat",
    };

    const enclosedPercent: IModifier = {
      value: settings.enclosedModifier || 0,
      valueType: "flat",
    };

    const discount: IModifier = {
      value: 0, // Default value for global modifier set
      valueType: "flat",
    };

    const companyTariff: IModifier = {
      value: 0, // Default value for global modifier set
      valueType: "flat",
    };

    const companyTariffDiscount: IModifier = {
      value: 0, // Default value for global modifier set
      valueType: "flat",
    };

    const companyTariffEnclosedFee: IModifier = {
      value: 0, // Default value for global modifier set
      valueType: "flat",
    };

    const fixedCommission: IModifier = {
      value: 0, // Default value for global modifier set
      valueType: "flat",
    };

    // Transform service levels from settings
    const serviceLevels: IServiceLevelModifier[] = (
      settings.serviceLevels || []
    ).map((level) => ({
      serviceLevelOption: level.value,
      value: level.markup,
    }));

    // Transform state modifiers to Map format
    const states = new Map();
    if (settings.stateModifiers) {
      settings.stateModifiers.forEach((modifier) => {
        const amount =
          typeof modifier.amount === "string"
            ? parseInt(modifier.amount)
            : modifier.amount;
        states.set(modifier.state, {
          type: modifier.type,
          direction: modifier.direction,
          amount: amount,
        });
      });
    }

    // Transform state-to-state modifiers to routes
    const routes: Array<{
      origin: string;
      destination: string;
      value: number;
      valueType: string;
    }> = [];
    if (settings.stateToStateModifiers) {
      settings.stateToStateModifiers.forEach((modifier) => {
        const value =
          modifier.type === "Decrease" ? modifier.amount * -1 : modifier.amount;
        routes.push({
          origin: modifier.fromState,
          destination: modifier.toState,
          value: value,
          valueType: "flat",
        });
      });
    }

    return {
      portalId: null, // Global modifier set has no specific portal
      isGlobal: true, // This is a global modifier set
      inoperable,
      fuel,
      irr,
      whiteGlove,
      oversize,
      enclosedFlat,
      enclosedPercent,
      discount,
      companyTariff,
      companyTariffDiscount,
      companyTariffEnclosedFee,
      fixedCommission,
      states,
      routes,
      zips: [], // Empty array for now
      vehicles: [], // Empty array for now
      serviceLevels,
      createdAt: new Date(),
      updatedAt: settings.updatedAt || new Date(),
    };
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new ModifierSetMigration();

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
