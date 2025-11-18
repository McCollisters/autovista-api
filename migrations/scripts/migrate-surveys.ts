import {
  MigrationBase,
  MigrationResult,
  MigrationUtils,
} from "../utils/migration-base";

// Configuration constants
const MAX_SURVEYS_TO_PROCESS = 10; // Set to null or undefined to process all surveys

/**
 * Survey Migration Script
 *
 * This migration transforms surveys and survey responses from the old format to the new schema structure.
 * Key transformations:
 * - Maps old survey questions to new question structure
 * - Transforms question types (isScale -> rating, hasExplanation -> open_end)
 * - Creates a single survey with all questions
 * - Groups survey responses by user and transforms to new format
 * - Maps status values to new enum values
 *
 * IMPORTANT: This migration processes surveys and survey responses from the source database and
 * creates surveys and survey responses in the destination database.
 *
 * Testing vs Production:
 * - Set MAX_SURVEYS_TO_PROCESS = 15 (or any number) for testing with limited surveys
 * - Set MAX_SURVEYS_TO_PROCESS = null to process ALL surveys in production
 *
 * To run this migration:
 * 1. Set your MongoDB connection strings:
 *    export MIGRATION_SOURCE_URI="mongodb://localhost:27017/source-database"
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/migrate-surveys.ts
 */

interface OldSurveyQuestion {
  _id: any;
  question: string;
  isScale?: boolean;
  order?: number;
  hasExplanation?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

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

interface IQuestion {
  questionText: string;
  type: "rating" | "open_end";
}

interface IResponse {
  questionId: any;
  answer: string | number;
}

export class SurveyMigration extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running survey migration UP...");

      // Get source connection (prod database) for reading
      const sourceConnection = this.getSourceConnection();
      const sourceDb = sourceConnection.db;

      // Get destination connection (dev database) for writing
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!sourceDb || !destinationDb) {
        throw new Error("Database connections not available");
      }

      const sourceSurveyQuestionsCollection =
        sourceDb.collection("surveyquestions");
      const sourceSurveyResponsesCollection =
        sourceDb.collection("surveyresponses");
      const destinationSurveysCollection = destinationDb.collection("surveys");
      const destinationSurveyResponsesCollection =
        destinationDb.collection("surveyresponses");

      // Count existing documents in source
      const totalQuestions =
        await sourceSurveyQuestionsCollection.countDocuments();
      const totalResponses =
        await sourceSurveyResponsesCollection.countDocuments();

      console.log(
        `📦 Found ${totalQuestions} survey questions in source database`,
      );
      console.log(
        `📦 Found ${totalResponses} survey responses in source database`,
      );

      if (totalQuestions === 0) {
        return {
          success: true,
          message: "No survey questions found to migrate",
          recordsAffected: 0,
        };
      }

      // Apply limit if specified
      const limit = MAX_SURVEYS_TO_PROCESS || totalQuestions;
      console.log(
        `📊 Processing ${limit} survey questions (limit: ${MAX_SURVEYS_TO_PROCESS || "none"})`,
      );

      // Get survey questions from source database
      const surveyQuestions = await sourceSurveyQuestionsCollection
        .find({})
        .sort({ order: 1 }) // Sort by order to maintain question sequence
        .limit(limit)
        .toArray();

      console.log(
        `📦 Retrieved ${surveyQuestions.length} survey questions to migrate`,
      );

      if (surveyQuestions.length === 0) {
        return {
          success: true,
          message: "No survey questions found to migrate",
          recordsAffected: 0,
        };
      }

      // Transform survey questions to new format
      const transformedSurvey = this.transformSurveyQuestions(
        surveyQuestions as OldSurveyQuestion[],
      );

      // Check if survey already exists
      const existingSurvey = await destinationSurveysCollection.findOne({});
      let surveyId = existingSurvey?._id;

      if (!existingSurvey) {
        // Insert the transformed survey into destination database
        const insertResult =
          await destinationSurveysCollection.insertOne(transformedSurvey);

        if (insertResult.acknowledged) {
          surveyId = insertResult.insertedId;
          console.log("✅ Survey created successfully");
        } else {
          console.error("❌ Failed to save survey");
          return {
            success: false,
            message: "Failed to save survey",
            recordsAffected: 0,
          };
        }
      } else {
        console.log("⏭️  Survey already exists, using existing survey");
      }

      // Now migrate survey responses
      console.log("🔄 Migrating survey responses...");

      // Get survey responses from source database (sorted by createdAt descending - most recent first)
      const surveyResponses = await sourceSurveyResponsesCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      console.log(
        `📦 Retrieved ${surveyResponses.length} survey responses to migrate`,
      );

      if (surveyResponses.length > 0) {
        // Group responses by user (email) and create new format
        const groupedResponses = this.groupResponsesByUser(
          surveyResponses as OldSurveyResponse[],
          surveyId,
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
      }

      console.log(
        "✅ Survey and survey response migration completed successfully",
      );
      return {
        success: true,
        message: `Successfully migrated survey with ${surveyQuestions.length} questions and ${surveyResponses.length} responses`,
        recordsAffected: 1 + (surveyResponses.length > 0 ? 1 : 0),
      };
    } catch (error) {
      console.error("❌ Survey migration failed:", error);
      throw error;
    }
  }

  async down(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running survey migration DOWN...");

      // Get destination connection (dev database) for deletion
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!destinationDb) {
        throw new Error("Destination database connection not available");
      }

      const destinationSurveysCollection = destinationDb.collection("surveys");
      const destinationSurveyResponsesCollection =
        destinationDb.collection("surveyresponses");

      // Count existing documents in destination
      const totalSurveys = await destinationSurveysCollection.countDocuments();
      const totalResponses =
        await destinationSurveyResponsesCollection.countDocuments();

      console.log(`📦 Found ${totalSurveys} surveys in destination database`);
      console.log(
        `📦 Found ${totalResponses} survey responses in destination database`,
      );

      if (totalSurveys === 0 && totalResponses === 0) {
        return {
          success: true,
          message: "No surveys or survey responses found to rollback",
          recordsAffected: 0,
        };
      }

      // Delete all survey responses first
      let deletedResponses = 0;
      if (totalResponses > 0) {
        const deleteResponsesResult =
          await destinationSurveyResponsesCollection.deleteMany({});
        deletedResponses = deleteResponsesResult.deletedCount;
        console.log(`✅ Deleted ${deletedResponses} survey responses`);
      }

      // Delete all surveys
      let deletedSurveys = 0;
      if (totalSurveys > 0) {
        const deleteSurveysResult =
          await destinationSurveysCollection.deleteMany({});
        deletedSurveys = deleteSurveysResult.deletedCount;
        console.log(`✅ Deleted ${deletedSurveys} surveys`);
      }

      console.log(
        `✅ Rollback completed: deleted ${deletedSurveys} surveys and ${deletedResponses} survey responses`,
      );

      return {
        success: true,
        message: `Successfully deleted ${deletedSurveys} surveys and ${deletedResponses} survey responses`,
        recordsAffected: deletedSurveys + deletedResponses,
      };
    } catch (error) {
      console.error("❌ Survey rollback failed:", error);
      throw error;
    }
  }

  private transformSurveyQuestions(questions: OldSurveyQuestion[]): any {
    // Transform questions to new format
    const transformedQuestions: IQuestion[] = [];

    questions.forEach((question) => {
      // Always add the main question
      if (question.isScale) {
        transformedQuestions.push({
          questionText: question.question || "",
          type: "rating",
        });
      } else {
        transformedQuestions.push({
          questionText: question.question || "",
          type: "open_end",
        });
      }

      // If the question has an explanation field, add a separate open-end question for it
      if (question.hasExplanation) {
        transformedQuestions.push({
          questionText: `${question.question || ""} - Please explain your answer`,
          type: "open_end",
        });
      }
    });

    return {
      description: "Migrated survey from legacy system",
      status: "active",
      questions: transformedQuestions,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private groupResponsesByUser(
    responses: OldSurveyResponse[],
    surveyId: any,
  ): any[] {
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
  const migration = new SurveyMigration();

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
