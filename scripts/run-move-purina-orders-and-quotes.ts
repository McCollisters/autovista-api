#!/usr/bin/env tsx
/**
 * Move orders + quotes for Purina/Nestle to a new portal.
 *
 * Criteria:
 * - Order portalId == SOURCE_PORTAL_ID
 * - Order customer email ends with @purina.nestle.com
 *
 * Actions:
 * - Update order.portalId (+ order.portal) to TARGET_PORTAL_ID
 * - Update quote(s) with same refId to TARGET_PORTAL_ID
 *
 * Usage:
 *   tsx -r dotenv/config scripts/run-move-purina-orders-and-quotes.ts
 *   tsx -r dotenv/config scripts/run-move-purina-orders-and-quotes.ts --dry-run
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/environment";
import { Order, Quote } from "../src/_global/models";
import { logger } from "../src/core/logger";

const SOURCE_PORTAL_ID = "63e26995a61aff3a7efb3deb";
const TARGET_PORTAL_ID = "69664e5968d3227b9d6860c6";
const EMAIL_DOMAIN = "@purina.nestle.com";

const parseArgs = () => {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
  };
};

const toObjectId = (value: string) => new mongoose.Types.ObjectId(value);

const run = async () => {
  const { dryRun } = parseArgs();

  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB");

    const sourcePortalObjectId = toObjectId(SOURCE_PORTAL_ID);
    const targetPortalObjectId = toObjectId(TARGET_PORTAL_ID);

    const emailRegex = new RegExp(`${EMAIL_DOMAIN.replace(".", "\\.")}$`, "i");

    const query = {
      portalId: sourcePortalObjectId,
      $or: [
        { "customer.email": { $regex: emailRegex } },
        { "customer.customerEmail": { $regex: emailRegex } },
      ],
    };

    const cursor = Order.find(query)
      .select("_id refId quoteId customer portalId")
      .lean()
      .cursor();

    let processed = 0;
    let orderUpdated = 0;
    let quoteUpdated = 0;

    const orderBulk: Array<any> = [];
    const quoteBulk: Array<any> = [];

    const flushBulk = async () => {
      if (!orderBulk.length && !quoteBulk.length) {
        return;
      }
      if (dryRun) {
        orderBulk.length = 0;
        quoteBulk.length = 0;
        return;
      }
      if (orderBulk.length) {
        const result = await Order.bulkWrite(orderBulk, { ordered: false });
        orderUpdated += result.modifiedCount || 0;
        orderBulk.length = 0;
      }
      if (quoteBulk.length) {
        const result = await Quote.bulkWrite(quoteBulk, { ordered: false });
        quoteUpdated += result.modifiedCount || 0;
        quoteBulk.length = 0;
      }
    };

    for await (const order of cursor) {
      processed += 1;

      const refId = (order as any).refId;
      const quoteId = (order as any).quoteId;

      orderBulk.push({
        updateOne: {
          filter: { _id: (order as any)._id },
          update: {
            $set: {
              portalId: targetPortalObjectId,
              portal: targetPortalObjectId,
            },
          },
        },
      });

      if (quoteId) {
        quoteBulk.push({
          updateOne: {
            filter: { _id: quoteId },
            update: {
              $set: {
                portal: targetPortalObjectId,
                portalId: targetPortalObjectId,
              },
            },
          },
        });
      } else if (refId != null) {
        quoteBulk.push({
          updateMany: {
            filter: { refId },
            update: {
              $set: {
                portal: targetPortalObjectId,
                portalId: targetPortalObjectId,
              },
            },
          },
        });
      }

      if (processed % 200 === 0) {
        await flushBulk();
      }
    }

    await flushBulk();

    logger.info("Purina/Nestle portal migration completed", {
      processedOrders: processed,
      updatedOrders: dryRun ? 0 : orderUpdated,
      updatedQuotes: dryRun ? 0 : quoteUpdated,
      dryRun,
    });
  } catch (error) {
    logger.error("Failed to move Purina/Nestle orders/quotes", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

run();
