import cron from "node-cron";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import { logger } from "./logger";
import { sendPickupDeliveryNotifications } from "@/order/tasks/sendPickupDeliveryNotifications";
import { sendPortalMonthlyReport } from "@/order/tasks/sendPortalMonthlyReport";
import { sendSurveyNotifications } from "@/order/tasks/sendSurveyNotifications";
import { Quote, Portal, Order, Settings } from "@/_global/models";
import { Status } from "@/_global/enums";

/**
 * Acquire a one-time lock for a named cron run, shared across all app
 * instances via MongoDB. The app runs on multiple EC2 instances behind
 * Elastic Beanstalk auto-scaling, and each instance registers its own cron
 * schedulers - without this lock, every instance fires the job and the same
 * email goes out once per instance.
 *
 * Uses an insert on a fixed _id so exactly one instance can win; the rest
 * get a duplicate-key error and skip.
 */
async function acquireCronLock(lockKey: string): Promise<boolean> {
  try {
    await mongoose.connection.collection("cron_locks").insertOne({
      _id: lockKey as any,
      createdAt: new Date(),
    });
    return true;
  } catch (error: any) {
    if (error?.code === 11000) {
      return false;
    }
    throw error;
  }
}

/**
 * Initialize cron jobs
 * This function sets up scheduled tasks that run automatically
 */
export function initializeCronJobs() {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    logger.info("Cron jobs enabled (non-production mode)");
  }
  cron.schedule(
    "0 6,10,14,20 * * *",
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

  // Survey emails: 8:00 Eastern daily. All orders: survey 48h after delivery; MMI: pre-survey the day of delivery.
  cron.schedule(
    "0 8 * * *",
    async () => {
      try {
        if (!isProduction) {
          logger.info("Skipping survey notifications in non-production");
          return;
        }
        await sendSurveyNotifications();
      } catch (error) {
        logger.error("Survey notifications cron failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      timezone: "America/New_York",
    },
  );

  const enablePortalMonthlyReportCron =
    process.env.ENABLE_PORTAL_MONTHLY_REPORT_CRON !== "false";

  if (!enablePortalMonthlyReportCron) {
    logger.info(
      "Portal monthly report cron disabled (ENABLE_PORTAL_MONTHLY_REPORT_CRON == false)",
    );
  } else {
    cron.schedule(
      "0 8 1 * *",
      async () => {
        try {
          if (!isProduction) {
            logger.info(
              "Skipping portal monthly report in non-production mode",
            );
            return;
          }

          const reportMonth = DateTime.now()
            .setZone("America/New_York")
            .minus({ months: 1 })
            .toFormat("yyyy-MM");
          const lockKey = `portal-monthly-report:${reportMonth}`;
          const acquired = await acquireCronLock(lockKey);
          if (!acquired) {
            logger.info(
              "Portal monthly report already sent by another instance, skipping",
              { lockKey },
            );
            return;
          }

          await sendPortalMonthlyReport();
        } catch (error) {
          logger.error("Portal monthly report cron failed", {
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
    "✅ Cron jobs initialized - Notifications scheduled at 6/10/14/20 (6am/10am/2pm/8pm EST)",
  );
}
