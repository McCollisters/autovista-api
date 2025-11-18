import { ObjectId } from "mongodb";
import {
  MigrationBase,
  MigrationResult,
  MigrationUtils,
} from "../utils/migration-base";

// Configuration constants
const MAX_LOGS_TO_PROCESS = 500; // Set to null or undefined to process all logs
const TEST_LOG_ID = "68cdea765c3394575ba5e7dc"; // Set to test a specific log ID

/**
 * Interface for old log structure
 */
interface OldLog {
  _id: {
    $oid: string;
  };
  order:
    | {
        $oid: string;
      }
    | string; // Handle both ObjectId format and string format
  templateName: string;
  subject?: string;
  user?: any;
  senderEmail?: string;
  senderName?: string;
  recipientEmail?: string;
  recipientName?: string;
  sent?: {
    $date: string;
  };
  createdAt: {
    $date: string;
  };
  updatedAt: {
    $date: string;
  };
  __v?: number;
}

/**
 * Notification template name mapping
 */
const NOTIFICATION_TEMPLATE_MAP: Record<string, string> = {
  "Pickup Confirmation": "agentsPickupConfirmation",
  "Delivery Confirmation": "agentsDeliveryConfirmation",
  OrderTransferee: "customerConfirmation",
  "Order Agent": "agentsConfirmation",
  "Customer Survey": "survey",
  "COD Payment Request": "paymentRequest",
  "Customer Survey Reminder": "surveyReminder",
  "Order Transferee Signature": "signatureRequest",
  // Add more mappings as needed
};

export class NotificationLogMigration extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running notification logs migration UP...");

      // Get source connection (prod database) for reading
      const sourceDb = this.getSourceConnection();
      // Get destination connection (new database) for writing
      const destDb = this.getDestinationConnection();

      // Get logs from source database
      const logs = await this.getLogs(sourceDb);
      console.log(`📊 Found ${logs.length} logs to process`);

      if (logs.length === 0) {
        return this.createSuccessResult("No logs found to migrate");
      }

      // Process logs in batches
      let ordersFound = 0;
      let ordersNotFound = 0;

      const result = await MigrationUtils.batchProcess(
        logs,
        async (log: OldLog, index: number) => {
          try {
            const logResult = await this.processLog(log, destDb);
            if (logResult === "found") {
              ordersFound++;
            } else if (logResult === "not_found") {
              ordersNotFound++;
            }
          } catch (error) {
            console.error(`❌ Failed to process log ${log._id}:`, error);
            // Continue processing other logs
          }
        },
        50, // Process 50 logs at a time
      );

      console.log(
        `📊 Processed ${result.processed} logs with ${result.errors} errors`,
      );
      console.log(
        `📈 Orders found: ${ordersFound}, Orders not found: ${ordersNotFound}`,
      );

      return this.createSuccessResult(
        `Successfully processed ${result.processed} logs (${ordersFound} orders found, ${ordersNotFound} orders not found)`,
        result.processed,
      );
    } catch (error) {
      console.error("❌ Notification logs migration failed:", error);
      return this.createErrorResult(
        `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async down(): Promise<MigrationResult> {
    console.log("🔄 Rolling back notification logs migration...");
    console.log(
      "ℹ️  Note: This migration only updates existing orders, no rollback needed",
    );
    return this.createSuccessResult("Rollback completed (no action required)");
  }

  /**
   * Get logs from source database
   */
  private async getLogs(sourceDb: any): Promise<OldLog[]> {
    let query: any;

    if (TEST_LOG_ID) {
      // Test mode: get specific log by ID
      console.log(`🔍 Test mode: Looking for log with ID ${TEST_LOG_ID}`);
      query = { _id: new ObjectId(TEST_LOG_ID) };
    } else {
      // Normal mode: get logs by template name
      query = {
        templateName: { $in: Object.keys(NOTIFICATION_TEMPLATE_MAP) },
      };
    }

    const logs = await sourceDb
      .collection("logs")
      .find(query)
      .sort({ createdAt: -1 }) // Sort by createdAt in descending order (newest first)
      .limit(TEST_LOG_ID ? 1 : MAX_LOGS_TO_PROCESS || 0)
      .toArray();

    return logs as unknown as OldLog[];
  }

  /**
   * Process a single log entry
   */
  private async processLog(
    log: OldLog,
    destDb: any,
  ): Promise<"found" | "not_found" | "error"> {
    // Debug: Log the order field structure
    if (TEST_LOG_ID || Math.random() < 0.01) {
      // Log 1% of logs for debugging, or always in test mode
      console.log(
        "🔍 Debug - Full log structure:",
        JSON.stringify(log, null, 2),
      );
    }

    // Check if order exists and is valid
    if (!log.order) {
      console.log(
        `⚠️  Log ${log._id?.$oid || log._id} has no order field. Order value:`,
        JSON.stringify(log.order),
      );
      return "error";
    }

    // Extract order ID - handle ObjectId, string, and ObjectId format
    if (TEST_LOG_ID) {
      console.log(`🔍 Debug - log.order:`, log.order);
      console.log(`🔍 Debug - typeof log.order:`, typeof log.order);
      console.log(`🔍 Debug - log.order.$oid:`, log.order?.$oid);
      console.log(`🔍 Debug - log.order.toString():`, log.order?.toString());
    }

    let orderId: string;
    if (typeof log.order === "string") {
      orderId = log.order;
    } else if (log.order?.$oid) {
      orderId = log.order.$oid;
    } else if (log.order?.toString) {
      // Handle ObjectId objects
      orderId = log.order.toString();
    } else {
      orderId = "";
    }

    if (TEST_LOG_ID) {
      console.log(`🔍 Debug - extracted orderId:`, orderId);
      console.log(`🔍 Debug - orderId truthy:`, !!orderId);
    }

    if (!orderId) {
      console.log(
        `⚠️  Log ${log._id?.$oid || log._id} has invalid order ID. Order value:`,
        JSON.stringify(log.order),
      );
      return "error";
    }

    // Find the corresponding order in destination database
    if (TEST_LOG_ID) {
      console.log(`🔍 Looking for order ${orderId} in destination database...`);
      console.log(`🔍 OrderId type: ${typeof orderId}, value: ${orderId}`);
      console.log(`🔍 ObjectId conversion: ${new ObjectId(orderId)}`);
    }

    const order = await destDb.collection("orders").findOne({
      _id: new ObjectId(orderId),
    });

    if (TEST_LOG_ID) {
      console.log(`🔍 Query result:`, order ? "FOUND" : "NOT FOUND");
      if (order) {
        console.log(`🔍 Found order with ID: ${order._id}`);
      }
    }

    if (!order) {
      // Try alternative query methods in test mode
      if (TEST_LOG_ID) {
        console.log(`🔍 Trying alternative queries...`);

        // Try querying by string ID
        const orderByString = await destDb.collection("orders").findOne({
          _id: orderId,
        });
        console.log(
          `🔍 Query by string ID:`,
          orderByString ? "FOUND" : "NOT FOUND",
        );

        // Try querying by refId (in case orders use refId instead of _id)
        const orderByRefId = await destDb.collection("orders").findOne({
          refId: parseInt(orderId),
        });
        console.log(`🔍 Query by refId:`, orderByRefId ? "FOUND" : "NOT FOUND");

        // Try querying by uniqueId
        const orderByUniqueId = await destDb.collection("orders").findOne({
          uniqueId: orderId,
        });
        console.log(
          `🔍 Query by uniqueId:`,
          orderByUniqueId ? "FOUND" : "NOT FOUND",
        );
      }

      // Always log in test mode, or sample in normal mode
      if (TEST_LOG_ID || Math.random() < 0.01) {
        console.log(`⚠️  Order ${orderId} not found in destination database`);

        if (TEST_LOG_ID) {
          // In test mode, also check if the order exists with a different query
          const orderCount = await destDb.collection("orders").countDocuments();
          console.log(`📊 Total orders in destination database: ${orderCount}`);

          // Try to find similar order IDs
          const similarOrders = await destDb
            .collection("orders")
            .find({ _id: { $regex: orderId.substring(0, 8) } })
            .limit(5)
            .toArray();

          if (similarOrders.length > 0) {
            console.log(
              `🔍 Found similar order IDs:`,
              similarOrders.map((o) => o._id),
            );
          }

          // Also try to find orders with similar patterns
          const allOrders = await destDb
            .collection("orders")
            .find({})
            .limit(10)
            .toArray();

          console.log(
            `🔍 Sample order IDs in destination:`,
            allOrders.map((o) => o._id),
          );
        }
      }
      return "not_found";
    }

    // Map template name to notification field
    const notificationField = NOTIFICATION_TEMPLATE_MAP[log.templateName];
    if (!notificationField) {
      console.log(`⚠️  Unknown template name: ${log.templateName}`);
      return "error";
    }

    // Determine status based on whether the log has a sent date
    const notificationStatus = log.sent ? "sent" : "pending";

    // Prepare notification update
    const sentDate = log.sent
      ? log.sent.$date
        ? log.sent.$date
        : log.sent
      : null;
    const notificationUpdate = {
      status: notificationStatus,
      sentAt: sentDate ? new Date(sentDate) : null,
      failedAt: null, // No failure tracking in this log format
      recipientEmail: log.recipientEmail || null,
    };

    // Debug logging in test mode
    if (TEST_LOG_ID) {
      console.log(
        `🔍 Template: "${log.templateName}" -> Field: "${notificationField}"`,
      );
      console.log(
        `🔍 Status: "${notificationStatus}", SentAt: ${log.sent ? log.sent.$date : "null"}`,
      );
      console.log(`🔍 RecipientEmail: ${log.recipientEmail || "null"}`);
      console.log(
        `🔍 Update object:`,
        JSON.stringify(notificationUpdate, null, 2),
      );
    }

    // Update the order's notification status
    const updateQuery = {
      $set: {
        [`notifications.${notificationField}`]: notificationUpdate,
      },
    };

    // Debug logging in test mode
    if (TEST_LOG_ID) {
      console.log(`🔍 Update query:`, JSON.stringify(updateQuery, null, 2));
    }

    const updateResult = await destDb
      .collection("orders")
      .updateOne({ _id: new ObjectId(orderId) }, updateQuery);

    if (TEST_LOG_ID) {
      console.log(`🔍 Update result:`, {
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount,
        acknowledged: updateResult.acknowledged,
      });
    }

    console.log(`✅ Updated ${notificationField} for order ${orderId}`);
    return "found";
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new NotificationLogMigration();
  const direction = process.argv[2] === "down" ? "down" : "up";

  migration
    .run(direction)
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("💥 Migration execution failed:", error);
      process.exit(1);
    });
}
