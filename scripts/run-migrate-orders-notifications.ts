#!/usr/bin/env tsx
/**
 * Migrate all orders and rebuild notifications structure.
 * Uses the existing order migration transform.
 */

import "dotenv/config";
import { OrderMigration } from "../migrations/scripts/migrate-orders";

const run = async () => {
  const migration = new OrderMigration();

  try {
    const result = await migration.run("up");
    if (!result.success) {
      console.error("Order migration failed:", result.message, result.error);
      process.exit(1);
    }
    console.log("Order migration completed:", result.message);
  } catch (error) {
    console.error("Order migration crashed:", error);
    process.exit(1);
  }
};

run();
