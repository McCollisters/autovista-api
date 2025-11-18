#!/usr/bin/env tsx
/**
 * Create Acertus Vehicle Script
 *
 * Creates a vehicle in the Acertus system.
 * This script requires Acertus API credentials and integration setup.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-create-acertus-vehicle.ts --make <make> --model <model> --year <year> [options]
 *
 * Note: This script is a placeholder. Acertus integration needs to be implemented.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { Order } from "../src/_global/models";
import { sendVehicleCreate, isAutonationPortal } from "../src/order/integrations/acertusClient";
import { logger } from "../src/core/logger";

async function createAcertusVehicle(orderId: string) {
  try {
    // Connect to database
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    // Find the order
    const order = await Order.findById(orderId).lean();

    if (!order) {
      console.error(`Error: Order with ID ${orderId} not found`);
      process.exit(1);
    }

    console.log("\n🚗 Creating Acertus Vehicles");
    console.log("=".repeat(80));
    console.log("\nOrder Details:");
    console.log(`  Order ID: ${order._id}`);
    console.log(`  Reference ID: ${order.refId || "N/A"}`);
    console.log(`  Portal: ${order.portalId || "N/A"}`);
    console.log(`  Vehicles: ${order.vehicles?.length || 0}`);

    if (!isAutonationPortal(order)) {
      console.log("\n⚠️  Order is not associated with the Autonation portal.");
      console.log("    ACERTUS integration will skip this order.\n");
      return;
    }

    console.log("\n🛠️  Sending vehicle create requests...");
    const results = await sendVehicleCreate(order);

    if (!results.length) {
      console.log("⚠️  No vehicles were submitted (order may have zero vehicles).\n");
    } else {
      results.forEach((result, index) => {
        const vehicleNumber = index + 1;
        if (result.success) {
          console.log(`✅ Vehicle ${vehicleNumber}: submission succeeded`);
        } else {
          console.log(
            `⚠️  Vehicle ${vehicleNumber}: submission reported failure (check logs)`,
          );
        }
      });
    }

    console.log("\n" + "=".repeat(80));
    console.log("🏁 Done submitting vehicles to ACERTUS");
    console.log("=".repeat(80) + "\n");

    logger.info(`Created ${results.filter((r) => r.success).length} vehicles in Acertus for order ${orderId}`);
  } catch (error) {
    logger.error("Error creating Acertus vehicle:", error);
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let orderId = "";

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--orderId" && args[i + 1]) {
    orderId = args[i + 1];
    i++;
  } else if (arg === "--order-id" && args[i + 1]) {
    orderId = args[i + 1];
    i++;
  } else if (arg === "--help" || arg === "-h") {
    console.log(`
Usage: tsx -r dotenv/config scripts/run-create-acertus-vehicle.ts [options]

Required Options:
  --orderId <id>      MongoDB ObjectId of the order to create vehicles for
  --order-id <id>     Alternative flag for order ID

Optional Options:
  --help, -h          Show this help message

Examples:
  tsx -r dotenv/config scripts/run-create-acertus-vehicle.ts --orderId 507f1f77bcf86cd799439011
`);
    process.exit(0);
  }
}

// Validate required fields
if (!orderId) {
  console.error("Error: --orderId is required");
  console.log("Use --help for usage information");
  process.exit(1);
}

// Run the script
createAcertusVehicle(orderId);
