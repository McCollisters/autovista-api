import mongoose from "mongoose";
import {
  MigrationBase,
  MigrationResult,
  MigrationUtils,
} from "../utils/migration-base";
import { Status } from "../../src/_global/enums";

// Configuration constants
const MAX_USERS_TO_PROCESS = null; // Set to null or undefined to process all users

/**
 * User Migration Script
 *
 * This migration transforms users from the old format to the new schema structure.
 * Key transformations:
 * - Maps old roles to new role enum values
 * - Handles isSuperAdmin flag for platform admin role
 * - Maps status values to new enum values
 * - Preserves all user authentication and profile data
 *
 * IMPORTANT: This migration processes users from the source database and
 * creates users in the destination database.
 *
 * Testing vs Production:
 * - Set MAX_USERS_TO_PROCESS = 15 (or any number) for testing with limited users
 * - Set MAX_USERS_TO_PROCESS = null to process ALL users in production
 *
 * To run this migration:
 * 1. Set your MongoDB connection strings:
 *    export MIGRATION_SOURCE_URI="mongodb://localhost:27017/source-database"
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/migrate-users.ts
 */

interface OldUser {
  _id: any;
  portalId?: any;
  portalRoles?: Array<{ portalId?: any; role?: string }>;
  portalIds?: any[];
  email: string;
  password: string;
  role?: string;
  isSuperAdmin?: boolean;
  status?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  mobilePhone?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  verificationCode?: string;
  verificationCodeSent?: Date;
  verificationCodeExpires?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class UserMigration extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running user migration UP...");

      // Get source connection (prod database) for reading
      const sourceConnection = this.getSourceConnection();
      const sourceDb = sourceConnection.db;

      // Get destination connection (dev database) for writing
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!sourceDb || !destinationDb) {
        throw new Error("Database connections not available");
      }

      const sourceUsersCollection = sourceDb.collection("users");
      const destinationUsersCollection = destinationDb.collection("users");

      // Count existing documents in source
      const totalUsers = await sourceUsersCollection.countDocuments();
      console.log(`📦 Found ${totalUsers} users in source database`);

      if (totalUsers === 0) {
        return {
          success: true,
          message: "No users found to migrate",
          recordsAffected: 0,
        };
      }

      // Apply limit if specified
      const limit = MAX_USERS_TO_PROCESS || totalUsers;
      console.log(
        `📊 Processing ${limit} users (limit: ${MAX_USERS_TO_PROCESS || "none"})`,
      );

      // Get users from source database (sorted by createdAt descending - most recent first)
      const users = await sourceUsersCollection
        .find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      console.log(`📦 Retrieved ${users.length} users to migrate`);

      if (users.length === 0) {
        return {
          success: true,
          message: "No users found to migrate",
          recordsAffected: 0,
        };
      }

      // Process users in batches
      let migratedCount = 0;
      let errorCount = 0;

      await MigrationUtils.batchProcess(
        users as OldUser[],
        async (user: OldUser, index) => {
          try {
            const transformedUser = this.transformUser(user);

            const replaceResult = await destinationUsersCollection.replaceOne(
              { _id: user._id },
              transformedUser,
              { upsert: true },
            );

            if (replaceResult.acknowledged) {
              migratedCount++;
              if (index % 10 === 0) {
                console.log(`📊 Processed ${index + 1}/${users.length} users`);
              }
            } else {
              console.error(`❌ Failed to save user ${user._id}`);
              errorCount++;
            }
          } catch (error) {
            console.error(`❌ Error processing user ${user._id}:`, error);
            errorCount++;
          }
        },
        10, // batchSize
      );

      console.log(
        `✅ User migration completed: ${migratedCount} successful, ${errorCount} errors`,
      );

      return {
        success: true,
        message: `Successfully processed ${users.length} users (${migratedCount} successful, ${errorCount} errors)`,
        recordsAffected: migratedCount,
      };
    } catch (error) {
      console.error("❌ User migration failed:", error);
      throw error;
    }
  }

  async down(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running user migration DOWN...");

      // Get destination connection (dev database) for deletion
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!destinationDb) {
        throw new Error("Destination database connection not available");
      }

      const destinationUsersCollection = destinationDb.collection("users");

      // Count existing documents in destination
      const totalUsers = await destinationUsersCollection.countDocuments();
      console.log(`📦 Found ${totalUsers} users in destination database`);

      if (totalUsers === 0) {
        return {
          success: true,
          message: "No users found to rollback",
          recordsAffected: 0,
        };
      }

      // Delete all users
      const deleteResult = await destinationUsersCollection.deleteMany({});

      console.log(
        `✅ Rollback completed: deleted ${deleteResult.deletedCount} users`,
      );

      return {
        success: true,
        message: `Successfully deleted ${deleteResult.deletedCount} users`,
        recordsAffected: deleteResult.deletedCount,
      };
    } catch (error) {
      console.error("❌ User rollback failed:", error);
      throw error;
    }
  }

  private transformUser(user: OldUser): any {
    const normalizePortalId = (portalId?: any) => {
      if (!portalId) {
        return null;
      }
      if (portalId instanceof mongoose.Types.ObjectId) {
        return portalId;
      }
      if (typeof portalId === "string" && mongoose.Types.ObjectId.isValid(portalId)) {
        return new mongoose.Types.ObjectId(portalId);
      }
      return portalId;
    };
    const normalizedUserId =
      user._id instanceof mongoose.Types.ObjectId
        ? user._id
        : typeof user._id === "string" && mongoose.Types.ObjectId.isValid(user._id)
        ? new mongoose.Types.ObjectId(user._id)
        : user._id;

    // Map old roles to new role enum values
    const roleMapping: Record<string, string> = {
      super_admin: "platform_admin",
      admin: "portal_admin",
      user: "portal_user",
      public: "public_user",
    };

    const mapRole = (roleValue?: string | null) => {
      if (!roleValue) {
        return "portal_user";
      }
      return roleMapping[roleValue.toLowerCase()] || "portal_user";
    };

    // Determine the new role based on old role and isSuperAdmin flag
    let newRole = "portal_user"; // default
    if (user.isSuperAdmin) {
      newRole = "platform_admin";
    } else if (user.role) {
      newRole = mapRole(user.role);
    }

    const normalizedStatus = (user.status || "").toString().toLowerCase();
    const status = Object.values(Status).includes(normalizedStatus as Status)
      ? normalizedStatus
      : Status.Active;

    // Check if reset password token has expired
    const now = new Date();
    const resetPasswordExpires = user.resetPasswordExpires;
    const isResetTokenExpired =
      resetPasswordExpires && resetPasswordExpires < now;

    const portalRolesFromSource = Array.isArray(user.portalRoles)
      ? user.portalRoles
          .filter((entry) => entry?.portalId)
          .map((entry) => ({
            portalId: normalizePortalId(entry.portalId),
            role: mapRole(entry.role || user.role),
          }))
      : [];
    const portalIdsFromSource = Array.isArray(user.portalIds)
      ? user.portalIds.map(normalizePortalId).filter(Boolean)
      : [];
    const portalRoles =
      portalRolesFromSource.length > 0
        ? portalRolesFromSource
        : portalIdsFromSource.length > 0
        ? portalIdsFromSource.map((portalId) => ({
            portalId,
            role: newRole,
          }))
        : user.portalId && ["portal_admin", "portal_user"].includes(newRole)
        ? [{ portalId: normalizePortalId(user.portalId), role: newRole }]
        : [];

    return {
      _id: normalizedUserId,
      portalId: normalizePortalId(user.portalId) || portalRoles[0]?.portalId || null,
      portalRoles,
      email: user.email,
      password: user.password,
      role: newRole,
      status: status,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      phone: user.phone || null,
      mobilePhone: user.mobilePhone || null,
      resetPasswordToken: isResetTokenExpired
        ? null
        : user.resetPasswordToken || null,
      resetPasswordExpires: isResetTokenExpired
        ? null
        : user.resetPasswordExpires || null,
      verificationCode: user.verificationCode || null,
      verificationCodeSent: user.verificationCodeSent || null,
      verificationCodeExpires: user.verificationCodeExpires || null,
      createdAt: user.createdAt || new Date(),
      updatedAt: user.updatedAt || new Date(),
    };
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new UserMigration();

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
