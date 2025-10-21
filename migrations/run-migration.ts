#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { MigrationBase } from "./utils/migration-base";

interface MigrationInfo {
  name: string;
  file: string;
  class: new () => MigrationBase;
}

/**
 * Migration Runner
 *
 * This script can run individual migrations or all pending migrations.
 *
 * Usage:
 *   npx ts-node migrations/run-migration.ts [migration-name] [direction]
 *
 * Examples:
 *   npx ts-node migrations/run-migration.ts                    # Run all pending migrations
 *   npx ts-node migrations/run-migration.ts 001-example       # Run specific migration up
 *   npx ts-node migrations/run-migration.ts 001-example down  # Rollback specific migration
 */

class MigrationRunner {
  private migrationsDir: string;

  constructor() {
    this.migrationsDir = path.join(__dirname, "scripts");
  }

  private async loadMigrations(): Promise<MigrationInfo[]> {
    const migrationFiles = fs
      .readdirSync(this.migrationsDir)
      .filter((file) => file.endsWith(".ts") && file !== "index.ts")
      .sort();

    const migrations: MigrationInfo[] = [];

    for (const file of migrationFiles) {
      try {
        const filePath = path.join(this.migrationsDir, file);
        const module = await import(filePath);

        // Find the migration class (should extend MigrationBase)
        const MigrationClass = Object.values(module).find(
          (exported: any) =>
            exported &&
            typeof exported === "function" &&
            exported.prototype instanceof MigrationBase,
        ) as new () => MigrationBase;

        if (MigrationClass) {
          migrations.push({
            name: path.basename(file, ".ts"),
            file,
            class: MigrationClass,
          });
        }
      } catch (error) {
        console.warn(`⚠️  Could not load migration ${file}:`, error);
      }
    }

    return migrations;
  }

  async runAllMigrations(direction: "up" | "down" = "up"): Promise<void> {
    console.log(`🚀 Running all ${direction} migrations...`);

    const migrations = await this.loadMigrations();

    if (migrations.length === 0) {
      console.log("📝 No migrations found");
      return;
    }

    console.log(`📋 Found ${migrations.length} migrations`);

    for (const migration of migrations) {
      console.log(`\n🔄 Running migration: ${migration.name}`);

      try {
        const migrationInstance = new migration.class();
        const result = await migrationInstance.run(direction);

        if (!result.success) {
          console.error(
            `❌ Migration ${migration.name} failed. Stopping execution.`,
          );
          process.exit(1);
        }
      } catch (error) {
        console.error(`💥 Error running migration ${migration.name}:`, error);
        process.exit(1);
      }
    }

    console.log("\n✅ All migrations completed successfully!");
  }

  async runSpecificMigration(
    migrationName: string,
    direction: "up" | "down" = "up",
  ): Promise<void> {
    console.log(
      `🚀 Running specific migration: ${migrationName} (${direction})`,
    );

    const migrations = await this.loadMigrations();
    const migration = migrations.find((m) => m.name === migrationName);

    if (!migration) {
      console.error(`❌ Migration '${migrationName}' not found`);
      console.log(
        "Available migrations:",
        migrations.map((m) => m.name).join(", "),
      );
      process.exit(1);
    }

    try {
      const migrationInstance = new migration.class();
      const result = await migrationInstance.run(direction);

      if (!result.success) {
        console.error(`❌ Migration ${migrationName} failed`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`💥 Error running migration ${migrationName}:`, error);
      process.exit(1);
    }

    console.log(`✅ Migration ${migrationName} completed successfully!`);
  }

  async listMigrations(): Promise<void> {
    console.log("📋 Available migrations:");

    const migrations = await this.loadMigrations();

    if (migrations.length === 0) {
      console.log("  No migrations found");
      return;
    }

    migrations.forEach((migration, index) => {
      console.log(`  ${index + 1}. ${migration.name} (${migration.file})`);
    });
  }
}

// Main execution
async function main() {
  const runner = new MigrationRunner();
  const args = process.argv.slice(2);

  const command = args[0];
  const direction = (args[1] as "up" | "down") || "up";

  try {
    switch (command) {
      case "list":
        await runner.listMigrations();
        break;
      case undefined:
        // No command specified, run all migrations
        await runner.runAllMigrations(direction);
        break;
      default:
        // Specific migration name
        await runner.runSpecificMigration(command, direction);
        break;
    }
  } catch (error) {
    console.error("💥 Migration runner failed:", error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}
