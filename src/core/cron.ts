import cron from "node-cron";
import { logger } from "./logger";
import { sendPickupDeliveryNotifications } from "@/order/tasks/sendPickupDeliveryNotifications";
import { sendPortalMonthlyReport } from "@/order/tasks/sendPortalMonthlyReport";
import { sendSurveyNotifications } from "@/order/tasks/sendSurveyNotifications";
import { Quote, Portal, Order, Settings } from "@/_global/models";
import { Status } from "@/_global/enums";

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
