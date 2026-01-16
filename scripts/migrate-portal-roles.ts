#!/usr/bin/env tsx
/**
 * Migrate users to portalRoles array
 *
 * Usage:
 *   tsx -r dotenv/config scripts/migrate-portal-roles.ts
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { User } from "../src/_global/models";
import { logger } from "../src/core/logger";
import { Role } from "../src/user/schema";

interface ScriptOptions {
  dryRun: boolean;
  limit?: number;
}

const parseArgs = (): ScriptOptions => {
  const args = process.argv.slice(2);
  const options: ScriptOptions = { dryRun: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--limit" && args[i + 1]) {
      const parsed = parseInt(args[i + 1], 10);
      if (!Number.isNaN(parsed)) {
        options.limit = parsed;
      }
      i++;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: tsx -r dotenv/config scripts/migrate-portal-roles.ts [options]

Options:
  --dry-run          Show planned updates without writing
  --limit <number>   Max users to inspect
  --help, -h         Show this help message
`);
      process.exit(0);
    }
  }

  return options;
};

async function migratePortalRoles() {
  try {
    const { dryRun, limit } = parseArgs();
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    const usersQuery = User.find({
      $or: [{ portalRoles: { $exists: false } }, { portalRoles: { $size: 0 } }],
    });
    if (limit) {
      usersQuery.limit(limit);
    }
    const users = await usersQuery;

    let updatedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      if (!user.portalId) {
        skippedCount += 1;
        continue;
      }

      if (user.role === Role.PortalAdmin || user.role === Role.PortalUser) {
        if (!dryRun) {
          await User.updateOne(
            { _id: user._id },
            {
              $set: {
                portalRoles: [{ portalId: user.portalId, role: user.role }],
              },
            },
          );
        }
        updatedCount += 1;
      } else {
        skippedCount += 1;
      }
    }

    logger.info("Portal roles migration completed", {
      dryRun,
      updatedCount,
      skippedCount,
      totalCandidates: users.length,
    });
  } catch (error) {
    logger.error("Error migrating portal roles", error);
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  }
}

migratePortalRoles();
