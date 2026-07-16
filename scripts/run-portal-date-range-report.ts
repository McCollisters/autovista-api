#!/usr/bin/env tsx
/**
 * Generate a CSV report for a portal over a custom date range (createdAt).
 *
 * Usage:
 *   npx tsx scripts/run-portal-date-range-report.ts "<portalId|companyName>" "YYYY-MM-DD" "YYYY-MM-DD" [outputPath]
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import ObjectsToCsv from "objects-to-csv";
import { Types } from "mongoose";
import { config } from "../src/config/environment";
import { logger } from "../src/core/logger";
import { Order, Portal } from "../src/_global/models";

const DEFAULT_OUTPUT_DIR = "reports";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatAddress(address: any): string {
  if (!address) {
    return "";
  }
  const line1 = address.address || "";
  const city = address.city || "";
  const state = address.state || "";
  const zip = address.zip || "";
  return [line1, city, state, zip].filter(Boolean).join(", ");
}

function formatVehicleInfo(vehicles: any[]): string {
  if (!vehicles || vehicles.length === 0) {
    return "";
  }
  return vehicles
    .map((vehicle) => {
      const parts = [
        vehicle.year || "",
        vehicle.make || "",
        vehicle.model || "",
      ].filter(Boolean);
      let text = parts.join(" ");
      if (vehicle.vin) {
        text += ` (VIN: ${vehicle.vin})`;
      }
      if (vehicle.isInoperable) {
        text += " - INOP";
      }
      return text.trim();
    })
    .join("\n")
    .replace(/,/g, " ");
}

function sumVehicleModifier(vehicles: any[], key: string): number {
  return (vehicles || []).reduce(
    (total, vehicle) => total + (vehicle?.pricing?.modifiers?.[key] || 0),
    0,
  );
}

function formatDate(value?: Date | null): string {
  if (!value) {
    return "";
  }
  return DateTime.fromJSDate(value).toFormat("MM/dd/yyyy");
}

async function resolvePortal(portalArg: string) {
  if (Types.ObjectId.isValid(portalArg)) {
    const portal = await Portal.findById(portalArg).lean();
    if (portal) {
      return portal;
    }
  }
  const escaped = escapeRegExp(portalArg.trim());
  return Portal.findOne({
    companyName: { $regex: new RegExp(`^${escaped}$`, "i") },
  }).lean();
}

async function run() {
  const [portalArg, startArg, endArg, outputArg] = process.argv.slice(2);

  if (!portalArg || !startArg || !endArg) {
    console.error(
      'Usage: npx tsx scripts/run-portal-date-range-report.ts "<portalId|companyName>" "YYYY-MM-DD" "YYYY-MM-DD" [outputPath]',
    );
    process.exit(1);
  }

  const start = DateTime.fromISO(startArg, { zone: "utc" }).startOf("day");
  const endInclusive = DateTime.fromISO(endArg, { zone: "utc" }).startOf("day");
  if (!start.isValid || !endInclusive.isValid) {
    console.error("Dates must be in YYYY-MM-DD format.");
    process.exit(1);
  }
  // Exclusive end = day after inclusive end date
  const endExclusive = endInclusive.plus({ days: 1 });

  await mongoose.connect(config.database.uri, config.database.options);
  logger.info("Connected to MongoDB");

  const portal = await resolvePortal(portalArg);
  if (!portal) {
    throw new Error(`Portal not found: ${portalArg}`);
  }

  const orders = await Order.find({
    portalId: portal._id,
    createdAt: { $gte: start.toJSDate(), $lt: endExclusive.toJSDate() },
  })
    .sort({ refId: 1 })
    .lean();

  let totalVehiclesCount = 0;
  let totalPrice = 0;
  let totalCommission = 0;
  let totalCompanyTariff = 0;
  let totalGrandTotal = 0;

  const rows = orders.map((order: any) => {
    const commission = sumVehicleModifier(order.vehicles, "commission");
    const companyTariff = sumVehicleModifier(order.vehicles, "companyTariff");
    const totalPricing = order.totalPricing?.total || 0;
    const grandTotal =
      order.totalPricing?.totalWithCompanyTariffAndCommission ??
      totalPricing + commission + companyTariff;
    const vehiclesCount = order.vehicles?.length || 0;

    totalVehiclesCount += vehiclesCount;
    totalPrice += totalPricing;
    totalCommission += commission;
    totalCompanyTariff += companyTariff;
    totalGrandTotal += grandTotal;

    const pickupDate = order.schedule?.pickupSelected || null;
    const deliveryDate =
      order.schedule?.deliveryCompleted ||
      order.schedule?.deliveryEstimated?.[0] ||
      null;

    return {
      "customer name": order.customer?.name || "",
      origin: formatAddress(order.origin?.address),
      destination: formatAddress(order.destination?.address),
      "pickup date": formatDate(pickupDate),
      "delivery date": formatDate(deliveryDate),
      "number of vehicles": vehiclesCount,
      "vehicle information": formatVehicleInfo(order.vehicles),
      price: totalPricing,
      commission,
      "company tariff": companyTariff,
      "grand total": grandTotal,
    };
  });

  const totalRow = {
    "customer name": "",
    origin: "",
    destination: "",
    "pickup date": "",
    "delivery date": "",
    "number of vehicles": totalVehiclesCount,
    "vehicle information": "TOTAL",
    price: totalPrice,
    commission: totalCommission,
    "company tariff": totalCompanyTariff,
    "grand total": totalGrandTotal,
  };

  const rangeLabel = `${start.toFormat("yyyy-MM-dd")}_to_${endInclusive.toFormat("yyyy-MM-dd")}`;
  const safePortalName = String(portal.companyName).replace(
    /[^a-z0-9-_\.]/gi,
    "_",
  );
  const outputDir = outputArg
    ? path.dirname(outputArg)
    : path.join(process.cwd(), DEFAULT_OUTPUT_DIR);
  const outputPath =
    outputArg ||
    path.join(outputDir, `portal-report-${safePortalName}-${rangeLabel}.csv`);

  const csvString = await new ObjectsToCsv([totalRow, ...rows]).toString();
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, csvString, "utf-8");

  logger.info("CSV report generated", {
    portal: portal.companyName,
    range: rangeLabel,
    outputPath,
    orders: rows.length,
    totalVehicles: totalVehiclesCount,
    totalPrice,
    totalCommission,
    totalGrandTotal,
  });

  await mongoose.disconnect();
}

run().catch(async (error) => {
  logger.error("Error generating portal date-range report", {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
  });
  await mongoose.disconnect();
  process.exit(1);
});
