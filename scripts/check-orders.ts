#!/usr/bin/env tsx
/**
 * Quick script to check specific orders
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { Order } from "../src/_global/models";
import { logger } from "../src/core/logger";

async function checkOrders() {
  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");
    logger.info(`Database URI: ${config.database.uri.split('@')[1] || 'hidden'}`);

    // First, let's check what the actual email pattern is in the database
    console.log("\n🔍 Searching for orders with purina.nestle emails...");
    const purinaOrders = await Order.find({
      "customer.email": { $regex: /purina/i }
    }).select("refId customer.email").limit(10).lean();
    
    console.log(`Found ${purinaOrders.length} orders with "purina" in email:`);
    purinaOrders.forEach((o: any) => {
      console.log(`   RefID: ${o.refId}, Email: ${o.customer?.email || 'N/A'}`);
    });

    const refIds = [219953, 219782];

    console.log("\n🔍 Searching for specific order numbers...");
    for (const refId of refIds) {
      // Try both number and string
      const order = await Order.findOne({ 
        $or: [
          { refId: refId },
          { refId: Number(refId) },
          { refId: String(refId) }
        ]
      }).lean();

      if (!order) {
        console.log(`\n❌ Order ${refId}: NOT FOUND`);
        continue;
      }

      const email = (order as any).customer?.email || "";
      const containsPurina = email.toLowerCase().includes("purina.nestle");

      console.log(`\n📦 Order ${refId}:`);
      console.log(`   Customer Email: ${email || "NOT SET"}`);
      console.log(`   Contains "purina.nestle": ${containsPurina ? "✅ YES" : "❌ NO"}`);
      console.log(`   Status: ${(order as any).status || "N/A"}`);
      
      if (email && !containsPurina) {
        console.log(`   ⚠️  Email does NOT match pattern!`);
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    logger.error("Error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkOrders();
