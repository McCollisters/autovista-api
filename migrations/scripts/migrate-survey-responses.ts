import {
  MigrationBase,
  MigrationResult,
  MigrationUtils,
} from "../utils/migration-base";

// Configuration constants
const MAX_SURVEY_RESPONSES_TO_PROCESS = 100; // Set to null or undefined to process all survey responses

/**
 * Survey Response Migration Script
 *
 * This migration transforms survey responses from the old format to the new schema structure.
 * Key transformations:
 * - Maps old survey response structure to new response format
 * - Groups responses by user and survey
 * - Transforms individual question responses to new structure
 * - Handles user and survey references
 *
 * IMPORTANT: This migration processes survey responses from the source database and
 * creates survey responses in the destination database.
 *
 * Testing vs Production:
 * - Set MAX_SURVEY_RESPONSES_TO_PROCESS = 15 (or any number) for testing with limited responses
 * - Set MAX_SURVEY_RESPONSES_TO_PROCESS = null to process ALL survey responses in production
 *
 * To run this migration:
 * 1. Set your MongoDB connection strings:
 *    export MIGRATION_SOURCE_URI="mongodb://localhost:27017/source-database"
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/migrate-survey-responses.ts
 */

interface OldSurveyResponse {
  _id: any;
  email?: string;
  portal?: any;
  portalName?: string;
  order?: any;
  orderId?: number;
  orderDelivery?: string;
  rating?: number;
  explanation?: string;
  question?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

interface IResponse {
  questionId: any;
  answer: string | number;
}

export class SurveyResponseMigration extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running survey response migration UP...");

      // Get source connection (prod database) for reading
      const sourceConnection = this.getSourceConnection();
      const sourceDb = sourceConnection.db;

      // Get destination connection (dev database) for writing
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!sourceDb || !destinationDb) {
        throw new Error("Database connections not available");
      }

      const sourceSurveyResponsesCollection =
        sourceDb.collection("surveyresponses");
      const destinationSurveyResponsesCollection =
        destinationDb.collection("surveyresponses");

      // Count existing documents in source
      const totalResponses =
        await sourceSurveyResponsesCollection.countDocuments();
      console.log(
        `📦 Found ${totalResponses} survey responses in source database`,
      );

      if (totalResponses === 0) {
        return {
          success: true,
          message: "No survey responses found to migrate",
          recordsAffected: 0,
        };
      }

      // Apply limit if specified
      const limit = MAX_SURVEY_RESPONSES_TO_PROCESS || totalResponses;
      console.log(
        `📊 Processing ${limit} survey responses (limit: ${MAX_SURVEY_RESPONSES_TO_PROCESS || "none"})`,
      );

      // Get survey responses from source database (sorted by createdAt descending - most recent first)
      const surveyResponses = await sourceSurveyResponsesCollection
        .find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      console.log(
        `📦 Retrieved ${surveyResponses.length} survey responses to migrate`,
      );

      if (surveyResponses.length === 0) {
        return {
          success: true,
          message: "No survey responses found to migrate",
          recordsAffected: 0,
        };
      }

      // Group responses by user (email) and create new format
      const groupedResponses = this.groupResponsesByUser(
        surveyResponses as OldSurveyResponse[],
      );

      // Process grouped responses in batches
      let migratedCount = 0;
      let errorCount = 0;

      await MigrationUtils.batchProcess(
        groupedResponses,
        async (groupedResponse, index) => {
          try {
            // Check if response already exists
            const existingResponse =
              await destinationSurveyResponsesCollection.findOne({
                userId: groupedResponse.userId,
                surveyId: groupedResponse.surveyId,
              });

            if (existingResponse) {
              console.log(
                `⏭️  Skipped response for user ${groupedResponse.userId} - already exists`,
              );
              return;
            }

            // Insert the transformed survey response into destination database
            const insertResult =
              await destinationSurveyResponsesCollection.insertOne(
                groupedResponse,
              );

            if (insertResult.acknowledged) {
              migratedCount++;
              if (index % 10 === 0) {
                console.log(
                  `📊 Processed ${index + 1}/${groupedResponses.length} survey responses`,
                );
              }
            } else {
              console.error(
                `❌ Failed to save survey response for user ${groupedResponse.userId}`,
              );
              errorCount++;
            }
          } catch (error) {
            console.error(
              `❌ Error processing survey response for user ${groupedResponse.userId}:`,
              error,
            );
            errorCount++;
          }
        },
        10, // batchSize
      );

      console.log(
        `✅ Survey response migration completed: ${migratedCount} successful, ${errorCount} errors`,
      );

      return {
        success: true,
        message: `Successfully processed ${groupedResponses.length} survey responses (${migratedCount} successful, ${errorCount} errors)`,
        recordsAffected: migratedCount,
      };
    } catch (error) {
      console.error("❌ Survey response migration failed:", error);
      throw error;
    }
  }

  async down(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running survey response migration DOWN...");

      // Get destination connection (dev database) for deletion
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!destinationDb) {
        throw new Error("Destination database connection not available");
      }

      const destinationSurveyResponsesCollection =
        destinationDb.collection("surveyresponses");

      // Count existing documents in destination
      const totalResponses =
        await destinationSurveyResponsesCollection.countDocuments();
      console.log(
        `📦 Found ${totalResponses} survey responses in destination database`,
      );

      if (totalResponses === 0) {
        return {
          success: true,
          message: "No survey responses found to rollback",
          recordsAffected: 0,
        };
      }

      // Delete all survey responses
      const deleteResult =
        await destinationSurveyResponsesCollection.deleteMany({});

      console.log(
        `✅ Rollback completed: deleted ${deleteResult.deletedCount} survey responses`,
      );

      return {
        success: true,
        message: `Successfully deleted ${deleteResult.deletedCount} survey responses`,
        recordsAffected: deleteResult.deletedCount,
      };
    } catch (error) {
      console.error("❌ Survey response rollback failed:", error);
      throw error;
    }
  }

  private groupResponsesByUser(responses: OldSurveyResponse[]): any[] {
    // Group responses by email (user identifier)
    const groupedByUser = new Map<string, OldSurveyResponse[]>();

    responses.forEach((response) => {
      const userKey = response.email || "anonymous";
      if (!groupedByUser.has(userKey)) {
        groupedByUser.set(userKey, []);
      }
      groupedByUser.get(userKey)!.push(response);
    });

    // Transform grouped responses to new format
    const transformedResponses: any[] = [];

    groupedByUser.forEach((userResponses, userEmail) => {
      // Get the first survey ID from the responses (assuming all responses are for the same survey)
      const surveyId = userResponses[0]?.question || null;

      // Transform individual responses
      const responses: IResponse[] = userResponses.map((response) => {
        // Use rating if available, otherwise use explanation
        const answer =
          response.rating !== undefined
            ? response.rating
            : response.explanation || "";

        return {
          questionId: response.question,
          answer: answer,
        };
      });

      // Create a single survey response for this user
      transformedResponses.push({
        userId: userEmail, // Using email as userId for now - this should be mapped to actual user ID
        surveyId: surveyId,
        responses: responses,
        createdAt: userResponses[0]?.createdAt || new Date(),
        updatedAt: userResponses[0]?.updatedAt || new Date(),
      });
    });

    return transformedResponses;
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new SurveyResponseMigration();

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
