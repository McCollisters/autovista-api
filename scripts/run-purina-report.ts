#!/usr/bin/env tsx
/**
 * Purina Nestle Orders Report
 *
 * Generates a CSV report of all orders with customer email containing "@purina.nestle"
 * Includes summary statistics at the top.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-purina-report.ts
 */

import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { config } from "../src/config/environment";
import { Order } from "../src/_global/models";
import { logger } from "../src/core/logger";
import { IOrder } from "../src/order/schema";

interface VehicleStats {
  sedan: number;
  suv: number;
  van: number;
  pickup_4_doors: number;
  pickup_2_doors: number;
  other: number;
}

interface ReportSummary {
  totalOrders: number;
  totalRevenue: number;
  totalVehicles: number;
  vehicleStats: VehicleStats;
  averageMiles: number;
}

function escapeCSV(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function calculateSummary(orders: IOrder[]): ReportSummary {
  let totalRevenue = 0;
  let totalVehicles = 0;
  let totalMiles = 0;
  const vehicleStats: VehicleStats = {
    sedan: 0,
    suv: 0,
    van: 0,
    pickup_4_doors: 0,
    pickup_2_doors: 0,
    other: 0,
  };

  orders.forEach((order) => {
    // Calculate revenue (use totalWithCompanyTariffAndCommission if available, otherwise total)
    const revenue =
      order.totalPricing?.totalWithCompanyTariffAndCommission ||
      order.totalPricing?.total ||
      0;
    totalRevenue += revenue;

    // Count miles (only count if miles exists)
    if (order.miles && typeof order.miles === "number") {
      totalMiles += order.miles;
    }

    // Count vehicles and categorize by type
    if (order.vehicles && Array.isArray(order.vehicles)) {
      totalVehicles += order.vehicles.length;

      order.vehicles.forEach((vehicle) => {
        const pricingClass = vehicle.pricingClass?.toLowerCase() || "";

        switch (pricingClass) {
          case "sedan":
            vehicleStats.sedan++;
            break;
          case "suv":
            vehicleStats.suv++;
            break;
          case "van":
            vehicleStats.van++;
            break;
          case "pickup_4_doors":
          case "pickup 4 doors":
            vehicleStats.pickup_4_doors++;
            break;
          case "pickup_2_doors":
          case "pickup 2 doors":
            vehicleStats.pickup_2_doors++;
            break;
          default:
            vehicleStats.other++;
            break;
        }
      });
    }
  });

  const averageMiles = orders.length > 0 ? totalMiles / orders.length : 0;

  return {
    totalOrders: orders.length,
    totalRevenue,
    totalVehicles,
    vehicleStats,
    averageMiles: Math.round(averageMiles * 100) / 100, // Round to 2 decimal places
  };
}

function generateCSV(orders: IOrder[], summary: ReportSummary): string {
  const lines: string[] = [];

  // Header section with summary statistics
  lines.push("PURINA NESTLE ORDERS REPORT");
  lines.push("Generated: " + new Date().toISOString());
  lines.push("");
  lines.push("SUMMARY STATISTICS");
  lines.push("=".repeat(50));
  lines.push(`Total Orders,${summary.totalOrders}`);
  lines.push(`Total Revenue,${formatCurrency(summary.totalRevenue)}`);
  lines.push(`Total Vehicles,${summary.totalVehicles}`);
  lines.push(`Average Miles,${summary.averageMiles.toFixed(2)}`);
  lines.push("");
  lines.push("VEHICLE BREAKDOWN");
  lines.push(`Sedans,${summary.vehicleStats.sedan}`);
  lines.push(`SUVs,${summary.vehicleStats.suv}`);
  lines.push(`Vans,${summary.vehicleStats.van}`);
  lines.push(`Pickups (4 Doors),${summary.vehicleStats.pickup_4_doors}`);
  lines.push(`Pickups (2 Doors),${summary.vehicleStats.pickup_2_doors}`);
  lines.push(`Other,${summary.vehicleStats.other}`);
  lines.push("");
  lines.push("");
  lines.push("ORDER DETAILS");
  lines.push("=".repeat(50));

  // Column headers for order details
  const headers = [
    "Order ID",
    "Ref ID",
    "Customer Name",
    "Customer Email",
    "Customer Phone",
    "Status",
    "Transport Type",
    "Miles",
    "Vehicles Count",
    "Vehicle Types",
    "Vehicle Makes/Models",
    "Origin City",
    "Origin State",
    "Destination City",
    "Destination State",
    "Revenue",
    "Created Date",
    "Booked Date",
  ];

  lines.push(headers.map(escapeCSV).join(","));

  // Order details
  orders.forEach((order) => {
    const vehicleTypes: string[] = [];
    const vehicleMakes: string[] = [];

    if (order.vehicles && Array.isArray(order.vehicles)) {
      order.vehicles.forEach((vehicle) => {
        const vehicleType = vehicle.pricingClass || "Unknown";
        vehicleTypes.push(vehicleType);
        vehicleMakes.push(
          `${vehicle.make || "N/A"} ${vehicle.model || "N/A"} (${vehicle.year || "N/A"})`,
        );
      });
    }

    const revenue =
      order.totalPricing?.totalWithCompanyTariffAndCommission ||
      order.totalPricing?.total ||
      0;

    const row = [
      order._id?.toString() || "",
      order.refId?.toString() || "",
      order.customer?.name || order.customer?.customerFullName || "",
      order.customer?.email || "",
      order.customer?.phone || order.customer?.customerPhone || "",
      order.status || "",
      order.transportType || "",
      order.miles?.toString() || "",
      order.vehicles?.length?.toString() || "0",
      vehicleTypes.join("; "),
      vehicleMakes.join("; "),
      order.origin?.address?.city || "",
      order.origin?.address?.state || "",
      order.destination?.address?.city || "",
      order.destination?.address?.state || "",
      formatCurrency(revenue),
      order.createdAt ? new Date(order.createdAt).toISOString() : "",
      order.bookedAt ? new Date(order.bookedAt).toISOString() : "",
    ];

    lines.push(row.map(escapeCSV).join(","));
  });

  return lines.join("\n");
}

async function generateReport() {
  try {
    // Connect to database
    logger.info("Connecting to MongoDB...");
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    // Query orders with customer email containing "purina.nestle" (without @ to catch both @purina.nestle and @purina.nestle.com)
    logger.info("Querying orders with purina.nestle email addresses...");
    logger.info(`Connected to database: ${config.database.uri.split('@')[1]?.split('/')[1] || 'unknown'}`);
    
    const orders = await Order.find({
      "customer.email": { $regex: /purina\.nestle/i },
    })
      .sort({ createdAt: -1 })
      .lean();
    
    logger.info(`Found ${orders.length} orders with purina.nestle in email address.`);

    logger.info(`Found ${orders.length} orders with @purina.nestle email addresses`);

    if (orders.length === 0) {
      logger.warn("No orders found matching the criteria.");
      logger.warn("Note: Make sure you're connected to the correct database environment.");
      await mongoose.disconnect();
      return;
    }

    if (orders.length !== 87) {
      logger.warn(
        `⚠️  Expected 87 orders but found ${orders.length}. Please verify you're connected to the correct database.`,
      );
    }

    // Calculate summary statistics
    logger.info("Calculating summary statistics...");
    const summary = calculateSummary(orders as IOrder[]);

    // Generate CSV
    logger.info("Generating CSV report...");
    const csvContent = generateCSV(orders as IOrder[], summary);

    // Write to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
    const filename = `purina-nestle-orders-report-${timestamp}.csv`;
    const filepath = path.join(process.cwd(), filename);

    fs.writeFileSync(filepath, csvContent, "utf-8");

    logger.info(`✅ Report generated successfully: ${filename}`);
    logger.info(`📊 Summary:`);
    logger.info(`   Total Orders: ${summary.totalOrders}`);
    logger.info(`   Total Revenue: ${formatCurrency(summary.totalRevenue)}`);
    logger.info(`   Total Vehicles: ${summary.totalVehicles}`);
    logger.info(`   Average Miles: ${summary.averageMiles.toFixed(2)}`);
    logger.info(`   Vehicle Breakdown:`);
    logger.info(`     Sedans: ${summary.vehicleStats.sedan}`);
    logger.info(`     SUVs: ${summary.vehicleStats.suv}`);
    logger.info(`     Vans: ${summary.vehicleStats.van}`);
    logger.info(`     Pickups (4 Doors): ${summary.vehicleStats.pickup_4_doors}`);
    logger.info(`     Pickups (2 Doors): ${summary.vehicleStats.pickup_2_doors}`);
    logger.info(`     Other: ${summary.vehicleStats.other}`);

    // Disconnect from database
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  } catch (error) {
    logger.error("Error generating report:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script if executed directly
generateReport()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Script failed:", error);
    process.exit(1);
  });
