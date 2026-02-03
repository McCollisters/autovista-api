#!/usr/bin/env tsx
/**
 * Rehash any user passwords that are stored in plaintext.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-rehash-plaintext-passwords.ts
 *   tsx -r dotenv/config scripts/run-rehash-plaintext-passwords.ts --dry-run
 *   tsx -r dotenv/config scripts/run-rehash-plaintext-passwords.ts --limit=100
 */

import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { config } from "../src/config/environment";
import { User } from "../src/_global/models";
import { logger } from "../src/core/logger";

interface ScriptOptions {
  dryRun?: boolean;
  limit?: number;
}

const BCRYPT_REGEX = /^\$2[aby]\$/;
const SALT_ROUNDS = 10;

const parseArgs = (): ScriptOptions => {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {};

  if (args.includes("--dry-run")) {
    options.dryRun = true;
  }

  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  if (limitArg) {
    const [, value] = limitArg.split("=");
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      options.limit = parsed;
    }
  }

  return options;
};

const isBcryptHash = (value?: string | null): boolean =>
  typeof value === "string" && BCRYPT_REGEX.test(value);

async function run(options: ScriptOptions = {}) {
  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    const query = {
      password: { $type: "string", $not: BCRYPT_REGEX },
    };

    const totalUsers = await User.countDocuments(query);
    const limit =
      options.limit && options.limit > 0 ? options.limit : totalUsers;
    console.log(
      `Found ${totalUsers} user(s) with non-bcrypt passwords. Processing ${limit}${
        options.dryRun ? " (dry run)" : ""
      }.`,
    );

    const cursor = User.find(query)
      .select("_id email password")
      .limit(limit)
      .cursor();

    let processed = 0;
    let updated = 0;

    for await (const user of cursor) {
      processed += 1;
      const plaintext = user.password;
      if (!plaintext || isBcryptHash(plaintext)) {
        continue;
      }

      if (options.dryRun) {
        console.log(
          `Would rehash password for user ${user._id} (${user.email})`,
        );
        continue;
      }

      const hashed = await bcrypt.hash(plaintext, SALT_ROUNDS);
      user.password = hashed;
      await user.save();
      updated += 1;
    }

    console.log(`Processed ${processed} user(s). Updated ${updated}.`);
  } catch (error) {
    logger.error("Error rehashing plaintext passwords:", error);
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  }
}

run(parseArgs());
