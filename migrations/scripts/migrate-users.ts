import {
  MigrationBase,
  MigrationResult,
  MigrationUtils,
} from "../utils/migration-base";

// Configuration constants
const MAX_USERS_TO_PROCESS = 50; // Set to null or undefined to process all users

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

            // Check if user already exists
            const existingUser = await destinationUsersCollection.findOne({
              _id: user._id,
            });

            if (existingUser) {
              console.log(`⏭️  Skipped user ${user._id} - already exists`);
              return;
            }

            // Insert the transformed user into destination database
            const insertResult =
              await destinationUsersCollection.insertOne(transformedUser);

            if (insertResult.acknowledged) {
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
    // Map old roles to new role enum values
    const roleMapping: Record<string, string> = {
      super_admin: "platform_admin",
      admin: "portal_admin",
      user: "portal_user",
      public: "public_user",
    };

    // Determine the new role based on old role and isSuperAdmin flag
    let newRole = "portal_user"; // default
    if (user.isSuperAdmin) {
      newRole = "platform_admin";
    } else if (user.role) {
      newRole = roleMapping[user.role.toLowerCase()] || "portal_user";
    }

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
    const status = statusMapping[user.status?.toLowerCase() || ""] || "active";

    // Check if reset password token has expired
    const now = new Date();
    const resetPasswordExpires = user.resetPasswordExpires;
    const isResetTokenExpired =
      resetPasswordExpires && resetPasswordExpires < now;

    return {
      _id: user._id,
      portalId: user.portalId || null, // This will be converted to ObjectId during import
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
