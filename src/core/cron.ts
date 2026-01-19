import cron from "node-cron";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "./logger";
import { sendPickupDeliveryNotifications } from "@/order/tasks/sendPickupDeliveryNotifications";
import { Quote, Portal, Order, Settings } from "@/_global/models";
import { Status } from "@/_global/enums";

const execAsync = promisify(exec);

/**
 * Initialize cron jobs
 * This function sets up scheduled tasks that run automatically
 */
export function initializeCronJobs() {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    logger.info("Cron jobs enabled (non-production mode)");
  }
  const enableMigrationCron = process.env.ENABLE_MIGRATION_CRON === "true";
  if (enableMigrationCron) {
    // Run migrations every 6 hours
    // Cron format: minute hour day month day-of-week
    // "30 */6 * * *" means: at minute 30, every 6 hours (12:30 AM, 6:30 AM, 12:30 PM, 6:30 PM EST)
    cron.schedule(
      "30 */6 * * *",
      async () => {
        logger.info("🕐 Scheduled migration job started (every 6 hours)");

        try {
          // Run the migration using npm script (same as: npm run migrate:all)
          const { stdout, stderr } = await execAsync("npm run migrate:all", {
            cwd: process.cwd(),
            env: process.env,
          });

          // Log the output - split by lines for better readability
          if (stdout) {
            const lines = stdout.split("\n").filter((line) => line.trim());
            logger.info("Migration output (all collections):");
            lines.forEach((line) => {
              // Log important lines (success/failure indicators)
              if (
                line.includes("✅") ||
                line.includes("❌") ||
                line.includes("Migration") ||
                line.includes("records")
              ) {
                logger.info(`  ${line.trim()}`);
              }
            });
          }

          if (stderr) {
            logger.warn("Migration stderr:", { output: stderr });
          }

          logger.info("✅ Scheduled migration job completed successfully");
        } catch (error: any) {
          // execAsync throws an error if the command exits with non-zero code
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const errorOutput = error.stdout || error.stderr || "";

          logger.error("❌ Scheduled migration job failed", {
            error: errorMessage,
            output: errorOutput,
            code: error.code,
          });
        }
      },
      {
        timezone: "America/New_York", // Adjust timezone as needed
      },
    );
  }

  const enableNotificationCron =
    process.env.ENABLE_NOTIFICATION_CRON === "true";
  if (!enableNotificationCron) {
    logger.info(
      "Notification cron disabled (ENABLE_NOTIFICATION_CRON != true)",
    );
  }

  if (enableNotificationCron) {
    cron.schedule(
      "0 8,10,12,14,16,18 * * *",
      async () => {
        try {
          if (!isProduction) {
            logger.info(
              "Skipping pickup/delivery notifications in non-production",
            );
            return;
          }
          await sendPickupDeliveryNotifications();
        } catch (error) {
          logger.error("Pickup/delivery notification cron failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      {
        timezone: "America/New_York",
      },
    );
  }

  const enableQuoteExpirationCron =
    process.env.ENABLE_QUOTE_EXPIRATION_CRON !== "false";

  if (!enableQuoteExpirationCron) {
    logger.info(
      "Quote expiration cron disabled (ENABLE_QUOTE_EXPIRATION_CRON == false)",
    );
  } else {
    cron.schedule(
      "0 11 * * *",
      async () => {
        try {
          const settings = await Settings.findOne({}).lean();
          const defaultExpirationDays = Number.isFinite(
            settings?.quoteExpirationDays as number,
          )
            ? Number(settings?.quoteExpirationDays)
            : 10;

          const activeStatuses = [
            Status.Active,
            "Active",
            "active",
            "Saved",
            "saved",
          ];
          const blockedStatuses = [
            Status.Booked,
            Status.Archived,
            Status.Expired,
            "Booked",
            "Archived",
            "Expired",
          ];

          const quotes = await Quote.find({
            status: { $nin: blockedStatuses },
          }).lean();

          if (!quotes.length) {
            return;
          }

          const portalIds = Array.from(
            new Set(
              quotes
                .map((quote) => quote.portal)
                .filter(Boolean)
                .map((id) => id.toString()),
            ),
          );

          const portals = await Portal.find({ _id: { $in: portalIds } }).lean();
          const portalMap = new Map(
            portals.map((portal) => [portal._id.toString(), portal]),
          );

          for (const quote of quotes) {
            const statusValue = String(quote.status || "");
            if (!activeStatuses.includes(statusValue as any)) {
              continue;
            }

            const portalId = quote.portal?.toString();
            const portal = portalId ? portalMap.get(portalId) : null;
            const portalExpiryDays = Number(
              (portal as any)?.options?.quoteExpiryDays,
            );
            const expirationDays = Number.isFinite(portalExpiryDays)
              ? portalExpiryDays
              : defaultExpirationDays;

            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() - expirationDays);

            const createdAt = (quote as any).createdAt
              ? new Date((quote as any).createdAt)
              : null;
            if (!createdAt || createdAt > expiryDate) {
              continue;
            }

            const orderExists = await Order.exists({ quoteId: quote._id });
            if (orderExists) {
              await Quote.updateOne(
                { _id: quote._id },
                { $set: { status: Status.Booked } },
              );
              continue;
            }

            await Quote.updateOne(
              { _id: quote._id },
              { $set: { status: Status.Expired } },
            );
          }
        } catch (error) {
          logger.error("Quote expiration cron failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      {
        timezone: "America/New_York",
      },
    );
  }

  logger.info(
    "✅ Cron jobs initialized - Notifications scheduled at 8/10/12/14/16/18",
  );
}
