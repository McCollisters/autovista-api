import { MigrationBase, MigrationResult } from "../utils/migration-base";

const BATCH_SIZE = 200;

export class BackfillSurveyResponseUserPortal extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log("🔄 Backfilling survey response user/portal IDs...");

      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!destinationDb) {
        throw new Error("Destination database connection not available");
      }

      const usersCollection = destinationDb.collection("users");
      const surveyResponsesCollection = destinationDb.collection("surveyresponses");

      const users = await usersCollection
        .find({ email: { $exists: true, $ne: null } })
        .project({ email: 1, portalId: 1 })
        .toArray();

      const userIndex = new Map(
        users.map((user) => [String(user.email).toLowerCase(), user]),
      );
      const userIdIndex = new Map(
        users.map((user) => [user._id?.toString?.() || "", user]),
      );

      const cursor = surveyResponsesCollection.find({
        $or: [
          { userId: { $type: "string" } },
          { portalId: { $exists: false } },
          { portalId: null },
          { userEmail: { $exists: true, $ne: null } },
          { email: { $exists: true, $ne: null } },
        ],
      });

      let processed = 0;
      let updated = 0;
      let skipped = 0;

      const bulkUpdates: any[] = [];

      while (await cursor.hasNext()) {
        const response = await cursor.next();
        if (!response) {
          break;
        }

        processed++;

        const updates: Record<string, any> = {};
        let hasUpdates = false;

        const userIdValue =
          typeof response.userId === "string"
            ? response.userId.trim()
            : "";
        const responseEmail =
          (response.userEmail || response.email || "").toString().trim();

        if (typeof response.userId === "string") {
          const emailKey = userIdValue.toLowerCase();
          const userInfo =
            userIndex.get(emailKey) || userIdIndex.get(userIdValue);

          if (userInfo?._id) {
            updates.userId = userInfo._id;
            if (!response.portalId && userInfo.portalId) {
              updates.portalId = userInfo.portalId;
            }
            hasUpdates = true;
          }
        }

        if (!hasUpdates && responseEmail) {
          const userInfo = userIndex.get(responseEmail.toLowerCase());
          if (userInfo?._id) {
            updates.userId = userInfo._id;
            if (!response.portalId && userInfo.portalId) {
              updates.portalId = userInfo.portalId;
            }
            hasUpdates = true;
          }
        }

        if (!hasUpdates && !response.portalId && response.userId) {
          const userInfo = userIdIndex.get(
            response.userId?.toString?.() || "",
          );
          if (userInfo?.portalId) {
            updates.portalId = userInfo.portalId;
            hasUpdates = true;
          }
        }

        if (!hasUpdates) {
          skipped++;
          continue;
        }

        bulkUpdates.push({
          updateOne: {
            filter: { _id: response._id },
            update: { $set: updates },
          },
        });

        if (bulkUpdates.length >= BATCH_SIZE) {
          const result = await surveyResponsesCollection.bulkWrite(bulkUpdates);
          updated += result.modifiedCount || 0;
          bulkUpdates.length = 0;
        }
      }

      if (bulkUpdates.length > 0) {
        const result = await surveyResponsesCollection.bulkWrite(bulkUpdates);
        updated += result.modifiedCount || 0;
      }

      return this.createSuccessResult(
        `Processed ${processed} survey responses (${updated} updated, ${skipped} skipped)`,
        updated,
      );
    } catch (error) {
      console.error("❌ Survey response backfill failed:", error);
      return this.createErrorResult(
        "Survey response backfill failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async down(): Promise<MigrationResult> {
    return this.createSuccessResult(
      "No down migration for survey response backfill.",
      0,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new BackfillSurveyResponseUserPortal();
  migration
    .run("up")
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("💥 Migration execution failed:", error);
      process.exit(1);
    });
}
