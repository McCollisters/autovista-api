import { Collection } from "mongodb";
import { MigrationBase, MigrationResult } from "../utils/migration-base";

const BATCH_SIZE = 500;

/**
 * Legacy Survey Migration Script
 *
 * Copies survey questions and survey responses from the legacy API database
 * to the new API database "as-is" (same documents, same _id values).
 *
 * To run this migration:
 * 1. Set your MongoDB connection strings:
 *    export MIGRATION_SOURCE_URI="mongodb://localhost:27017/source-database"
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 * 2. Optional: export CLEAR_DEST=true to wipe destination collections first
 * 3. Run: npx tsx -r dotenv/config migrations/scripts/migrate-legacy-surveys.ts
 */

type CollectionConfig = {
  name: string;
  label: string;
};

const COLLECTIONS: CollectionConfig[] = [
  { name: "surveyquestions", label: "Survey Questions" },
  { name: "surveyresponses", label: "Survey Responses" },
];

export class LegacySurveyMigration extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running legacy survey migration UP...");

      const sourceConnection = this.getSourceConnection();
      const destinationConnection = this.getDestinationConnection();
      const sourceDb = sourceConnection.db;
      const destinationDb = destinationConnection.db;

      if (!sourceDb || !destinationDb) {
        throw new Error("Database connections not available");
      }

      const shouldClear = String(process.env.CLEAR_DEST || "").toLowerCase();
      const clearDestination = ["1", "true", "yes"].includes(shouldClear);

      let totalUpserts = 0;

      for (const collection of COLLECTIONS) {
        const sourceCollection = sourceDb.collection(collection.name);
        const destinationCollection = destinationDb.collection(collection.name);

        const sourceCount = await sourceCollection.countDocuments();
        console.log(
          `📦 Found ${sourceCount} ${collection.label} in source database`,
        );

        if (sourceCount === 0) {
          continue;
        }

        if (clearDestination) {
          const deleteResult = await destinationCollection.deleteMany({});
          console.log(
            `🧹 Cleared ${deleteResult.deletedCount} ${collection.label} in destination database`,
          );
        }

        const cursor = sourceCollection.find({});
        let batch: any[] = [];
        let processed = 0;

        for await (const doc of cursor) {
          batch.push(doc);
          if (batch.length >= BATCH_SIZE) {
            processed += await this.upsertBatch(
              destinationCollection,
              batch,
            );
            batch = [];
          }
        }

        if (batch.length > 0) {
          processed += await this.upsertBatch(destinationCollection, batch);
        }

        console.log(
          `✅ Migrated ${processed} ${collection.label} to destination database`,
        );
        totalUpserts += processed;
      }

      return this.createSuccessResult(
        `Successfully migrated legacy survey data`,
        totalUpserts,
      );
    } catch (error) {
      console.error("❌ Legacy survey migration failed:", error);
      throw error;
    }
  }

  async down(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running legacy survey migration DOWN...");

      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!destinationDb) {
        throw new Error("Destination database connection not available");
      }

      let deleted = 0;
      for (const collection of COLLECTIONS) {
        const destinationCollection = destinationDb.collection(collection.name);
        const deleteResult = await destinationCollection.deleteMany({});
        deleted += deleteResult.deletedCount || 0;
      }

      return this.createSuccessResult(
        `Deleted ${deleted} legacy survey records from destination database`,
        deleted,
      );
    } catch (error) {
      console.error("❌ Legacy survey rollback failed:", error);
      throw error;
    }
  }

  private async upsertBatch(
    destinationCollection: Collection,
    documents: any[],
  ): Promise<number> {
    if (!documents.length) {
      return 0;
    }

    const operations = documents.map((doc) => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    }));

    const result = await destinationCollection.bulkWrite(operations, {
      ordered: false,
    });

    return (result.upsertedCount || 0) + (result.modifiedCount || 0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new LegacySurveyMigration();
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
