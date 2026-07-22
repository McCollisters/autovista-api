#!/usr/bin/env tsx
/**
 * Manually trigger the COD-paid -> Super Dispatch partial order sync
 * for a given refId (same path as updateOrder when hasPaid flips true).
 *
 * Usage:
 *   MONGODB_PROD_URI=... tsx scripts/run-sync-cod-order-to-super.ts 307534
 *   # or with NODE_ENV=production so config picks prod URI
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Order, Portal } from "../src/_global/models";
import { sendPartialOrderToSuper } from "../src/order/integrations/sendPartialOrderToSuper";
import { TransportType } from "../src/_global/enums";

const refIdArg = process.argv[2];
if (!refIdArg) {
  console.error("Usage: tsx scripts/run-sync-cod-order-to-super.ts <refId>");
  process.exit(1);
}

const uri =
  process.env.MONGODB_PROD_URI ||
  process.env.MONGODB_DEV_URI ||
  process.env.MONGODB_URI;

if (!uri) {
  console.error("No MongoDB URI found (MONGODB_PROD_URI / MONGODB_DEV_URI)");
  process.exit(1);
}

async function main() {
  const refIdNum = Number(refIdArg);
  console.log("Connecting...", uri.replace(/\/\/.*@/, "//***@"));
  await mongoose.connect(uri);

  const order = await Order.findOne({
    $or: [{ refId: refIdNum }, { refId: refIdArg }, { refId: String(refIdNum) }],
  });

  if (!order) {
    console.error(`Order not found: ${refIdArg}`);
    process.exit(1);
  }

  const schedule = order.schedule as any;
  const summary = {
    _id: String(order._id),
    refId: order.refId,
    paymentType: order.paymentType,
    hasPaid: order.hasPaid,
    transportType: order.transportType,
    orderTableStatus: (order as any).orderTableStatus,
    tms: order.tms,
    tmsPartialOrder: order.tmsPartialOrder,
    portalId: String(order.portalId),
    pickupSelected: schedule?.pickupSelected,
    pickupEstimated: schedule?.pickupEstimated,
    deliveryEstimated: schedule?.deliveryEstimated,
    serviceLevel: schedule?.serviceLevel ?? (order as any).serviceLevel,
    origin: {
      city: order.origin?.address?.city,
      state: order.origin?.address?.state,
      zip: order.origin?.address?.zip,
    },
    destination: {
      city: order.destination?.address?.city,
      state: order.destination?.address?.state,
      zip: order.destination?.address?.zip,
    },
    vehicleCount: Array.isArray((order as any).vehicles)
      ? (order as any).vehicles.length
      : 0,
  };

  console.log("\n=== Order summary ===");
  console.log(JSON.stringify(summary, null, 2));

  const paymentType = String(order.paymentType || "").toLowerCase();
  const isCod = paymentType === "cod";
  const isWhiteGlove = order.transportType === TransportType.WhiteGlove;
  const hasTmsGuid = Boolean(order.tms?.guid);

  console.log("\n=== Sync gate checks ===");
  console.log({
    isCod,
    hasPaid: order.hasPaid === true,
    isWhiteGlove,
    hasTmsGuid,
    wouldAutoSyncOnPaidFlip:
      isCod && order.hasPaid === true && !isWhiteGlove && !hasTmsGuid,
  });

  if (hasTmsGuid) {
    console.log("\nAlready has TMS guid — nothing to send. Exiting.");
    await mongoose.disconnect();
    return;
  }

  if (!isCod) {
    console.warn("\nWarning: paymentType is not COD; continuing anyway.");
  }

  const portal = await Portal.findById(order.portalId);
  const pickupStart =
    schedule?.pickupEstimated?.[0] || schedule?.pickupSelected;
  const pickupEnd =
    schedule?.pickupEstimated?.[1] || schedule?.pickupSelected;
  const deliveryStart = schedule?.deliveryEstimated?.[0];
  const deliveryEnd = schedule?.deliveryEstimated?.[1];
  const dateRanges = [
    pickupStart,
    pickupEnd,
    deliveryStart || pickupEnd,
    deliveryEnd || deliveryStart || pickupEnd,
  ].filter(Boolean) as Date[];

  console.log("\n=== Pre-send checks ===");
  console.log({
    hasPortal: Boolean(portal),
    portalName: (portal as any)?.companyName,
    dateRangesLength: dateRanges.length,
    dateRanges,
  });

  if (!portal || dateRanges.length < 4) {
    console.error(
      "\nBLOCKED: Missing portal or schedule dates (need 4 date range values).",
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  // Super Dispatch requires a 5-digit zip; leading zeros are often stripped
  // (e.g. Livingston NJ 07039 stored as "7039").
  const padZip = (zip?: string | null) => {
    const digits = String(zip ?? "").replace(/\D/g, "");
    if (digits.length > 0 && digits.length < 5) {
      return digits.padStart(5, "0");
    }
    return String(zip ?? "");
  };

  let pickupZip = order.origin?.address?.zip || "";
  let deliveryZip = order.destination?.address?.zip || "";
  const paddedPickup = padZip(pickupZip);
  const paddedDelivery = padZip(deliveryZip);
  let zipFixed = false;

  if (paddedPickup !== pickupZip && order.origin?.address) {
    console.log(`\nFixing origin zip: ${pickupZip} -> ${paddedPickup}`);
    order.origin.address.zip = paddedPickup;
    pickupZip = paddedPickup;
    zipFixed = true;
  }
  if (paddedDelivery !== deliveryZip && order.destination?.address) {
    console.log(
      `Fixing destination zip: ${deliveryZip} -> ${paddedDelivery}`,
    );
    order.destination.address.zip = paddedDelivery;
    deliveryZip = paddedDelivery;
    zipFixed = true;
  }
  if (zipFixed) {
    await order.save();
    console.log("Saved corrected zip(s) on order.");
  }

  const serviceLevel =
    schedule?.serviceLevel || (order as any).serviceLevel;

  console.log("\n=== Calling sendPartialOrderToSuper ===");
  try {
    const superResponse = await sendPartialOrderToSuper({
      quotes: (order as any).vehicles || [],
      orderNumber: String(order.refId),
      reg: order.reg ? Number(order.reg) : undefined,
      portal,
      dateRanges,
      transportType: order.transportType,
      pickupCity: order.origin?.address?.city || "",
      pickupState: order.origin?.address?.state || "",
      pickupZip,
      deliveryCity: order.destination?.address?.city || "",
      deliveryState: order.destination?.address?.state || "",
      deliveryZip,
      serviceLevel: Number(serviceLevel),
    });

    console.log("\n=== Super Dispatch response ===");
    console.log(JSON.stringify(superResponse, null, 2));

    if (superResponse) {
      order.tms = {
        guid: superResponse?.guid || null,
        status: superResponse?.status || null,
        createdAt: superResponse?.created_at
          ? new Date(superResponse.created_at)
          : undefined,
        updatedAt: superResponse?.changed_at
          ? new Date(superResponse.changed_at)
          : undefined,
      };
      order.tmsPartialOrder = true;
      if (order.hasPaid === true && isCod) {
        (order as any).orderTableStatus = "New";
      }
      await order.save();
      console.log("\nSaved tms + tmsPartialOrder on order.");
      console.log({ tms: order.tms, tmsPartialOrder: order.tmsPartialOrder });
    } else {
      console.error("\nSuper Dispatch returned empty/falsy response.");
    }
  } catch (error) {
    console.error("\n=== ERROR from sendPartialOrderToSuper ===");
    console.error(error instanceof Error ? error.stack || error.message : error);
    await mongoose.disconnect();
    process.exit(1);
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
