import {
  MigrationBase,
  MigrationResult,
} from "../utils/migration-base";

export class UpdateModifierSetPortalWideCommission extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log("🔄 Updating modifier sets: fixedCommission -> portalWideCommission");

      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;
      if (!destinationDb) {
        throw new Error("Destination database connection not available");
      }

      const collection = destinationDb.collection("modifiersets");

      const updateResult = await collection.updateMany(
        { fixedCommission: { $exists: true }, portalWideCommission: { $exists: false } },
        [
          { $set: { portalWideCommission: "$fixedCommission" } },
          { $unset: "fixedCommission" },
        ],
      );

      console.log(
        `✅ Updated ${updateResult.modifiedCount} modifier sets`,
      );

      return this.createSuccessResult(
        `Updated ${updateResult.modifiedCount} modifier sets`,
        updateResult.modifiedCount,
      );
    } catch (error) {
      console.error("❌ Modifier set update failed:", error);
      throw error;
    }
  }

  async down(): Promise<MigrationResult> {
    try {
      console.log("↩️ Reverting modifier sets: portalWideCommission -> fixedCommission");

      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;
      if (!destinationDb) {
        throw new Error("Destination database connection not available");
      }

      const collection = destinationDb.collection("modifiersets");

      const updateResult = await collection.updateMany(
        { portalWideCommission: { $exists: true }, fixedCommission: { $exists: false } },
        [
          { $set: { fixedCommission: "$portalWideCommission" } },
          { $unset: "portalWideCommission" },
        ],
      );

      console.log(
        `✅ Reverted ${updateResult.modifiedCount} modifier sets`,
      );

      return this.createSuccessResult(
        `Reverted ${updateResult.modifiedCount} modifier sets`,
        updateResult.modifiedCount,
      );
    } catch (error) {
      console.error("❌ Modifier set revert failed:", error);
      throw error;
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new UpdateModifierSetPortalWideCommission();
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
