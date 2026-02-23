/**
 * Survey notification cron task (runs ~8am Eastern).
 *
 * - ALL orders: send standard survey 48 hours after delivered
 *   → "We're Listening. How did we do?" (survey.hbs). Window: tms.updatedAt 48–72 hours ago.
 * - MMI portals (MMI_PORTALS) additionally: send mmi-pre-survey-notification the day of delivery
 *   → "McCollister's Values your Opinion" (mmi-pre-survey-notification.hbs). Window: tms.updatedAt in last 24 hours.
 */

import { logger } from "@/core/logger";
import { Order } from "@/_global/models";
import { sendSurvey } from "@/order/notifications/sendSurvey";
import { sendPreSurveyNotificationMmi } from "@/order/notifications/sendPreSurveyNotificationMmi";
import { MMI_PORTALS } from "@/_global/constants/portalIds";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_24_HOURS = 24 * MS_PER_HOUR;
const MS_48_HOURS = 48 * MS_PER_HOUR;
const MS_72_HOURS = 72 * MS_PER_HOUR;

const deliveredOrderQuery = {
  "tms.status": { $in: ["delivered", "invoiced"] },
  "tms.guid": { $exists: true, $nin: [null, ""] },
  "customer.email": { $exists: true, $nin: [null, ""] },
};

/**
 * Find orders eligible for survey (48h after delivery) and for MMI pre-survey (day of delivery).
 */
async function getEligibleOrders(): Promise<{
  survey: Array<{ _id: string }>;
  mmiPreSurvey: Array<{ _id: string }>;
}> {
  const now = Date.now();
  const fortyEightHoursAgo = new Date(now - MS_48_HOURS);
  const seventyTwoHoursAgo = new Date(now - MS_72_HOURS);
  const twentyFourHoursAgo = new Date(now - MS_24_HOURS);

  // Survey: ALL orders (including MMI) delivered 48–72 hours ago; only if survey not yet sent (status !== "sent", sentAt null/missing)
  const surveyNotSent = {
    $and: [
      { $or: [{ "notifications.survey.sentAt": { $exists: false } }, { "notifications.survey.sentAt": null }] },
      { $or: [{ "notifications.survey.status": { $exists: false } }, { "notifications.survey.status": { $ne: "sent" } }] },
    ],
  };
  const surveyOrders = await Order.find(
    {
      ...deliveredOrderQuery,
      "tms.updatedAt": { $gte: seventyTwoHoursAgo, $lte: fortyEightHoursAgo },
      ...surveyNotSent,
    },
    { _id: 1 },
  )
    .lean();

  // MMI pre-survey: MMI portals only, delivered in last 24 hours (day of delivery); only if not yet sent (status !== "sent", sentAt null/missing)
  const surveyReminderNotSent = {
    $and: [
      { $or: [{ "notifications.surveyReminder.sentAt": { $exists: false } }, { "notifications.surveyReminder.sentAt": null }] },
      { $or: [{ "notifications.surveyReminder.status": { $exists: false } }, { "notifications.surveyReminder.status": { $ne: "sent" } }] },
    ],
  };
  const mmiOrders = await Order.find(
    {
      ...deliveredOrderQuery,
      "tms.updatedAt": { $gte: twentyFourHoursAgo, $lte: new Date() },
      ...surveyReminderNotSent,
      portalId: { $in: MMI_PORTALS },
    },
    { _id: 1 },
  )
    .lean();

  return {
    survey: surveyOrders.map((o) => ({ _id: String(o._id) })),
    mmiPreSurvey: mmiOrders.map((o) => ({ _id: String(o._id) })),
  };
}

/**
 * Run survey notifications: survey (48h after delivery) for all orders; MMI pre-survey (day of delivery) for MMI only (additional email).
 */
export async function sendSurveyNotifications(): Promise<void> {
  try {
    const { survey: surveyOrderIds, mmiPreSurvey: mmiOrderIds } =
      await getEligibleOrders();

    let surveySent = 0;
    let surveyFailed = 0;
    let mmiPreSurveySent = 0;
    let mmiPreSurveyFailed = 0;

    for (const { _id } of surveyOrderIds) {
      const result = await sendSurvey({ orderId: _id });
      if (result.success) {
        surveySent++;
      } else {
        surveyFailed++;
      }
    }

    for (const { _id } of mmiOrderIds) {
      const result = await sendPreSurveyNotificationMmi({ orderId: _id });
      if (result.success) {
        mmiPreSurveySent++;
      } else {
        mmiPreSurveyFailed++;
      }
    }

    logger.info("Survey notifications cron completed", {
      surveySent,
      surveyFailed,
      mmiPreSurveySent,
      mmiPreSurveyFailed,
      totalSurvey: surveyOrderIds.length,
      totalMmiPreSurvey: mmiOrderIds.length,
    });
  } catch (error) {
    logger.error("Survey notifications cron failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
