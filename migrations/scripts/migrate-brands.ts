/**
 * Brand Migration Script
 *
 * This migration transforms makes and models from the old format to the new Brand schema structure.
 * Key transformations:
 * - Maps old make/model structure to new Brand schema
 * - Transforms models array to match new structure with pricingClass
 *
 * IMPORTANT: This migration processes brands from the source database and
 * overwrites any existing brands in the destination database with the same _id.
 *
 * To run this migration:
 * 1. Set your MongoDB connection strings:
 *    export MIGRATION_SOURCE_URI="mongodb://localhost:27017/source-database"
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/migrate-brands.ts
 */

import {
  MigrationBase,
  MigrationResult,
  MigrationUtils,
} from "../utils/migration-base";

// Configuration constants
const MAX_BRANDS_TO_PROCESS: number | null = null; // Set to null to process all brands

/**
 * VehicleClass enum values (from src/_global/enums.ts)
 */
const VALID_PRICING_CLASSES = {
  sedan: "sedan",
  suv: "suv",
  van: "van",
  pickup_4_doors: "pickup_4_doors",
  pickup_2_doors: "pickup_2_doors",
} as const;

type ValidPricingClass =
  | typeof VALID_PRICING_CLASSES[keyof typeof VALID_PRICING_CLASSES];

/**
 * Old Brand/Make structure (likely from old database)
 */
interface OldBrand {
  _id: any;
  make?: string;
  brand?: string; // Some old systems use "brand" instead of "make"
  models?: Array<{
    model?: string;
    name?: string; // Some old systems use "name" instead of "model"
    pricingClass?: string;
    class?: string; // Some old systems use "class" instead of "pricingClass"
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Brand Migration Class
 */
export class BrandMigration extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running brand migration UP...");

      // Get source connection (prod database) for reading
      const sourceConnection = this.getSourceConnection();
      const sourceDb = sourceConnection.db;

      // Get destination connection (dev database) for writing
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!sourceDb || !destinationDb) {
        throw new Error("Database connections not available");
      }

      // Try common collection names for makes/brands
      const possibleCollectionNames = ["brands", "makes", "brand", "make"];
      let sourceBrandsCollection = null;
      let collectionName = null;

      for (const name of possibleCollectionNames) {
        const collection = sourceDb.collection(name);
        const count = await collection.countDocuments();
        if (count > 0) {
          sourceBrandsCollection = collection;
          collectionName = name;
          console.log(`📦 Found brands in collection: ${name} (${count} documents)`);
          break;
        }
      }

      if (!sourceBrandsCollection) {
        console.log("⚠️  No brands collection found in source database");
        console.log("   Searched for: brands, makes, brand, make");
        return this.createSuccessResult("No brands found to migrate");
      }

      const destinationBrandsCollection = destinationDb.collection("brands");

      // Count existing documents in source
      const totalBrands = await sourceBrandsCollection.countDocuments();
      console.log(`📊 Found ${totalBrands} brands to migrate from source`);

      if (totalBrands === 0) {
        return this.createSuccessResult("No brands found to migrate");
      }

      // Get brands from source (sorted by make/brand name)
      let cursor = sourceBrandsCollection.find({}).sort({ make: 1, brand: 1 });

      // Apply limit if specified for testing
      if (MAX_BRANDS_TO_PROCESS) {
        cursor = cursor.limit(MAX_BRANDS_TO_PROCESS);
        console.log(
          `🔬 Testing mode: Processing only ${MAX_BRANDS_TO_PROCESS} brands`,
        );
      } else {
        console.log(
          `🚀 Production mode: Processing ALL brands`,
        );
      }

      const brands = await cursor.toArray();

      let migratedCount = 0;
      let errorCount = 0;

      await MigrationUtils.batchProcess(
        brands as OldBrand[],
        async (brand: OldBrand, index) => {
          try {
            const transformedBrand = this.transformBrand(brand);

            // Replace or insert the transformed brand into destination database
            // This will overwrite existing brands with the same _id
            const replaceResult = await destinationBrandsCollection.replaceOne(
              { _id: brand._id },
              transformedBrand,
              { upsert: true },
            );

            if (
              replaceResult.modifiedCount > 0 ||
              replaceResult.upsertedCount > 0
            ) {
              migratedCount++;
              if (index % 10 === 0) {
                console.log(`✅ Migrated ${index + 1}/${brands.length} brands`);
              }
            }
          } catch (error) {
            errorCount++;
            console.error(`❌ Error migrating brand ${brand._id}:`, error);
          }
        },
        50, // Process 50 brands at a time
      );

      const message = `Migration completed. Processed: ${migratedCount} brands (overwritten existing), Errors: ${errorCount}`;
      return this.createSuccessResult(message, migratedCount);
    } catch (error) {
      return this.createErrorResult(
        "Failed to run brand migration",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async down(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running brand migration DOWN (rollback)...");

      // Get destination connection (dev database) for rollback
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!destinationDb) {
        throw new Error("Destination database connection not available");
      }

      const destinationBrandsCollection = destinationDb.collection("brands");

      // Remove ALL brands from destination (since we're doing a full migration)
      const result = await destinationBrandsCollection.deleteMany({});

      return this.createSuccessResult(
        `Rolled back ${result.deletedCount} brands (cleared destination database)`,
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
   * Convert make name to title case (each word capitalized)
   * Examples: "FORD" → "Ford", "CHEVROLET" → "Chevrolet", "BMW" → "Bmw"
   */
  private toTitleCase(str: string): string {
    if (!str) return str;

    return str
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Normalize pricing class to match VehicleClass enum values
   * Handles various formats: Sedan, sedan, SEDAN, pickup4door, pickup_4door, pick up 4 doors, etc.
   */
  private normalizePricingClass(
    pricingClass: string | undefined,
  ): ValidPricingClass {
    if (!pricingClass) {
      return "sedan"; // Default to sedan if missing
    }

    // Convert to lowercase and normalize
    // First normalize "pick up" (two words) to "pickup" (one word)
    let normalized = pricingClass.toLowerCase().trim();
    normalized = normalized.replace(/\s+/g, " "); // Normalize multiple spaces to single space
    normalized = normalized.replace(/pick\s+up/g, "pickup"); // Convert "pick up" to "pickup"

    // Direct matches
    if (normalized === "sedan") return "sedan";
    if (normalized === "suv") return "suv";
    if (normalized === "van") return "van";

    // Handle pickup variations (now that "pick up" is normalized to "pickup")
    if (
      normalized === "pickup_4_doors" ||
      normalized === "pickup_4doors" ||
      normalized === "pickup4doors" ||
      normalized === "pickup4door" ||
      normalized === "pickup_4door" ||
      normalized === "pickup 4 doors" ||
      normalized === "pickup 4door" ||
      normalized === "4door" ||
      normalized === "4_doors" ||
      normalized === "4doors"
    ) {
      return "pickup_4_doors";
    }

    if (
      normalized === "pickup_2_doors" ||
      normalized === "pickup_2doors" ||
      normalized === "pickup2doors" ||
      normalized === "pickup2door" ||
      normalized === "pickup_2door" ||
      normalized === "pickup 2 doors" ||
      normalized === "pickup 2door" ||
      normalized === "2door" ||
      normalized === "2_doors" ||
      normalized === "2doors"
    ) {
      return "pickup_2_doors";
    }

    // If no match found, log warning and default to sedan
    console.warn(
      `⚠️  Unknown pricing class "${pricingClass}" - defaulting to "sedan"`,
    );
    return "sedan";
  }

  /**
   * Transform old brand structure to new Brand schema
   */
  private transformBrand(oldBrand: OldBrand): any {
    // Extract make name - support both "make" and "brand" fields
    const rawMakeName = oldBrand.make || oldBrand.brand || "";

    if (!rawMakeName) {
      throw new Error(`Brand ${oldBrand._id} has no make or brand field`);
    }

    // Convert make name to title case (e.g., "FORD" → "Ford")
    const makeName = this.toTitleCase(rawMakeName);

    // Transform models array
    const transformedModels: Array<{ model: string; pricingClass: string }> = [];

    if (oldBrand.models && Array.isArray(oldBrand.models)) {
      oldBrand.models.forEach((model) => {
        // Support both "model" and "name" for model name
        const modelName = model.model || model.name;

        // Support both "pricingClass" and "class" for pricing class
        const rawPricingClass = model.pricingClass || model.class;

        // Normalize pricing class to match VehicleClass enum
        const pricingClass = this.normalizePricingClass(rawPricingClass);

        if (modelName) {
          transformedModels.push({
            model: modelName,
            pricingClass: pricingClass,
          });
        }
      });
    }

    return {
      _id: oldBrand._id,
      make: makeName,
      models: transformedModels,
      createdAt: oldBrand.createdAt || new Date(),
      updatedAt: oldBrand.updatedAt || new Date(),
    };
  }
}

// Run the migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new BrandMigration();

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
