#!/usr/bin/env tsx
/**
 * Send Order to Acertus Script
 *
 * Sends an order to the Acertus system.
 * This script requires Acertus API credentials and integration setup.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-send-order-to-acertus.ts --orderId <orderId>
 *
 * Note: This script is a placeholder. Acertus integration needs to be implemented.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { Order } from "../src/_global/models";
import { notifyOrderCreated, sendVehicleAssign, isAutonationPortal } from "../src/order/integrations/acertusClient";
import { logger } from "../src/core/logger";

async function sendOrderToAcertus(orderId: string) {
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

    console.log("\n📦 Sending Order to Acertus");
    console.log("=".repeat(80));
    console.log("\nOrder Details:");
    console.log(`  Order ID: ${order._id}`);
    console.log(`  Reference ID: ${order.refId || "N/A"}`);
    console.log(`  Portal: ${order.portalId || "N/A"}`);
    console.log(`  Vehicles: ${order.vehicles?.length || 0}`);
    console.log(
      `  Pickup: ${order.origin?.address?.city || "N/A"}, ${order.origin?.address?.state || "N/A"}`,
    );
    console.log(
      `  Delivery: ${order.destination?.address?.city || "N/A"}, ${order.destination?.address?.state || "N/A"}`,
    );

    if (!isAutonationPortal(order)) {
      console.log("\n⚠️  Order is not associated with the Autonation portal.");
      console.log("    ACERTUS integration will skip this order.\n");
      return;
    }

    console.log("\n🛠️  Sending order to Acertus...");
    
    // Send order created notification and ETAs
    await notifyOrderCreated(order);
    console.log("✅ Order created notification sent");
    
    // Send vehicle assign
    const assignResult = await sendVehicleAssign(order);
    if (assignResult) {
      console.log("✅ Vehicle assign sent");
    } else {
      console.log("⚠️  Vehicle assign failed (check logs)");
    }

    console.log("\n" + "=".repeat(80));
    console.log("🏁 Done sending order to ACERTUS");
    console.log("=".repeat(80) + "\n");

    logger.info(`Order ${orderId} sent to Acertus successfully`);
  } catch (error) {
    logger.error("Error sending order to Acertus:", error);
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
Usage: tsx -r dotenv/config scripts/run-send-order-to-acertus.ts [options]

Required Options:
  --orderId <id>      MongoDB ObjectId of the order to send
  --order-id <id>     Alternative flag for order ID

Optional Options:
  --help, -h          Show this help message

Examples:
  tsx -r dotenv/config scripts/run-send-order-to-acertus.ts --orderId 507f1f77bcf86cd799439011
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
sendOrderToAcertus(orderId);
