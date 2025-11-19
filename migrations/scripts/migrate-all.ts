import { PortalMigration } from "./migrate-portals.js";
import { UserMigration } from "./migrate-users.js";
import { QuoteMigration } from "./migrate-quotes.js";
import { OrderMigration } from "./migrate-orders.js";
import { ModifierSetMigration } from "./migrate-modifier-sets.js";
import { SurveyMigration } from "./migrate-surveys.js";
import { SurveyResponseMigration } from "./migrate-survey-responses.js";
import { NotificationLogMigration } from "./migrate-notification-logs.js";

/**
 * Master Migration Script
 *
 * This script runs ALL migrations in the correct order:
 * 1. Portals (must be first - other docs reference portals)
 * 2. Users (must be second - other docs reference users)
 * 3. Modifier Sets (references portals)
 * 4. Quotes
 * 5. Orders (references quotes, users, portals)
 * 6. Surveys
 * 7. Survey Responses (references surveys, orders, users)
 * 8. Notification Logs (references orders)
 *
 * IMPORTANT: All migrations use duplicate prevention:
 * - Portals, Orders, Quotes: replaceOne with upsert:true (updates if exists, inserts if new)
 * - Users, Surveys, Modifier Sets: insertOne with existence check (skips if exists)
 *
 * To run this migration:
 * npm run migrate:all
 */

export async function runAllMigrations() {
  console.log("🚀 Starting MASTER MIGRATION - All Collections");
  console.log("=".repeat(80));
  console.log("");

  const startTime = Date.now();
  const results: {
    name: string;
    success: boolean;
    recordsAffected?: number;
    error?: string;
  }[] = [];

  // Run migrations in dependency order
  const migrations = [
    { name: "Portals", migration: new PortalMigration() },
    { name: "Users", migration: new UserMigration() },
    { name: "Modifier Sets", migration: new ModifierSetMigration() },
    { name: "Quotes", migration: new QuoteMigration() },
    { name: "Orders", migration: new OrderMigration() },
    { name: "Surveys", migration: new SurveyMigration() },
    { name: "Survey Responses", migration: new SurveyResponseMigration() },
    {
      name: "Notification Logs",
      migration: new NotificationLogMigration(),
    },
  ];

  for (const { name, migration } of migrations) {
    try {
      console.log("=".repeat(80));
      console.log(`🔄 Running ${name} Migration...`);
      console.log("=".repeat(80));
      console.log("");

      const result = await migration.run("up");

      results.push({
        name,
        success: result.success,
        recordsAffected: result.recordsAffected,
        error: result.error,
      });

      if (result.success) {
        console.log("");
        console.log(
          `✅ ${name} migration completed: ${result.recordsAffected || 0} records`,
        );
      } else {
        console.log("");
        console.log(`❌ ${name} migration failed: ${result.message}`);
        if (result.error) {
          console.error(`   Error: ${result.error}`);
        }
      }
      console.log("");
    } catch (error) {
      console.log("");
      console.error(`💥 ${name} migration crashed:`, error);
      results.push({
        name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log("");
    }

    // Small delay between migrations to avoid overwhelming the database
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Print summary
  const duration = Date.now() - startTime;
  console.log("=".repeat(80));
  console.log("🎉 MASTER MIGRATION COMPLETE");
  console.log("=".repeat(80));
  console.log("");

  const totalRecords = results.reduce(
    (sum, r) => sum + (r.recordsAffected || 0),
    0,
  );
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`⏱️  Duration: ${duration}ms`);
  console.log(`📊 Total records migrated: ${totalRecords}`);
  console.log(`✅ Successful migrations: ${successful}/${results.length}`);
  console.log(`❌ Failed migrations: ${failed}/${results.length}`);
  console.log("");

  if (failed > 0) {
    console.log("Failed migrations:");
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    console.log("");
  }

  console.log("Detailed results:");
  results.forEach((r) => {
    const status = r.success ? "✅" : "❌";
    console.log(`  ${status} ${r.name}: ${r.recordsAffected || 0} records`);
  });

  console.log("=".repeat(80));

  // Return results instead of exiting when called programmatically
  return {
    success: failed === 0,
    failed,
    successful,
    totalRecords,
    duration,
    results,
  };
}

// Run the master migration if this file is executed directly
// Check if this module is the main module being executed
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("migrate-all.ts") ||
  process.argv[1]?.endsWith("migrate-all.js");

if (isMainModule) {
  runAllMigrations()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
