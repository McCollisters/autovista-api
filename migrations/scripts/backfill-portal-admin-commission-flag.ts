import { MigrationBase, MigrationResult } from "../utils/migration-base";
import { ObjectId } from "mongodb";

export class BackfillPortalAdminCommissionFlag extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log(
        "🔄 Backfilling portalAdmin.enablePortalWideCommission from modifier sets",
      );

      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;
      if (!destinationDb) {
        throw new Error("Destination database connection not available");
      }

      const modifierSetsCollection = destinationDb.collection("modifiersets");
      const portalsCollection = destinationDb.collection("portals");

      const modifierSets = await modifierSetsCollection
        .find({
          isGlobal: { $ne: true },
          portal: { $ne: null },
        })
        .project({ portal: 1, portalWideCommission: 1 })
        .toArray();

      const portalsWithCommission = new Set<string>();

      modifierSets.forEach((modifierSet) => {
        const portalId =
          modifierSet.portal instanceof ObjectId
            ? modifierSet.portal.toHexString()
            : String(modifierSet.portal);
        if (!ObjectId.isValid(portalId)) {
          return;
        }
        const commissionValue =
          modifierSet.portalWideCommission?.value ?? 0;
        if (commissionValue > 0) {
          portalsWithCommission.add(portalId);
        }
      });

      await portalsCollection.updateMany(
        {},
        {
          $set: {
            "options.portalAdmin.enablePortalWideCommission": false,
          },
        },
      );

      if (portalsWithCommission.size > 0) {
        await portalsCollection.updateMany(
          {
            _id: {
              $in: Array.from(portalsWithCommission).map(
                (id) => new ObjectId(id),
              ),
            },
          },
          {
            $set: {
              "options.portalAdmin.enablePortalWideCommission": true,
            },
          },
        );
      }

      console.log(
        `✅ Backfill complete for ${portalsWithCommission.size} portals`,
      );

      return this.createSuccessResult(
        `Backfilled ${portalsWithCommission.size} portals`,
        portalsWithCommission.size,
      );
    } catch (error) {
      console.error("❌ Backfill failed:", error);
      throw error;
    }
  }

  async down(): Promise<MigrationResult> {
    try {
      console.log(
        "↩️ Clearing portalAdmin.enablePortalWideCommission backfill",
      );

      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;
      if (!destinationDb) {
        throw new Error("Destination database connection not available");
      }

      const portalsCollection = destinationDb.collection("portals");

      const updateResult = await portalsCollection.updateMany(
        {},
        {
          $set: {
            "options.portalAdmin.enablePortalWideCommission": false,
          },
        },
      );

      console.log(
        `✅ Cleared portal admin commission flag on ${updateResult.modifiedCount} portals`,
      );

      return this.createSuccessResult(
        `Cleared ${updateResult.modifiedCount} portals`,
        updateResult.modifiedCount,
      );
    } catch (error) {
      console.error("❌ Backfill revert failed:", error);
      throw error;
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new BackfillPortalAdminCommissionFlag();
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
