import { logger } from "@/core/logger";
import { NotificationStatus } from "@/_global/enums";
import { Order, Portal } from "@/_global/models";
import { sendOrderPickupConfirmation } from "@/order/notifications/sendOrderPickupConfirmation";
import { sendOrderDeliveryConfirmation } from "@/order/notifications/sendOrderDeliveryConfirmation";
import { resolveAgentNotificationRecipients } from "@/order/notifications/resolveAgentNotificationRecipients";
import { MMI_PORTALS } from "@/_global/constants/portalIds";

const SIRVA_PORTAL_ID = "5e99f0b420e68d5f479d7317";
const DEFAULT_CUTOFF_DAYS = 60;

const getCutoffDate = () => {
  const envDate = process.env.NOTIFICATION_CUTOFF_DATE;
  if (!envDate) {
    const date = new Date();
    date.setDate(date.getDate() - DEFAULT_CUTOFF_DAYS);
    return date;
  }
  const parsed = new Date(envDate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  const fallback = new Date();
  fallback.setDate(fallback.getDate() - DEFAULT_CUTOFF_DAYS);
  return fallback;
};

const getOrderStatus = (order: any) =>
  String(order?.tms?.status || order?.sdStatus || "").toLowerCase();

const HOURS_48_MS = 48 * 60 * 60 * 1000;

const isWithinLast48Hours = (value?: Date | string | null) => {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const diffMs = Date.now() - date.getTime();
  return diffMs >= 0 && diffMs <= HOURS_48_MS;
};

const getPickupNotificationDate = (order: any) =>
  order?.schedule?.pickupCompleted ||
  order?.schedule?.pickupEstimated?.[0] ||
  order?.schedule?.pickupSelected ||
  null;

const getDeliveryNotificationDate = (order: any) =>
  order?.schedule?.deliveryCompleted ||
  order?.schedule?.deliveryEstimated?.[0] ||
  null;

const isSirvaOrder = (order: any) =>
  String(order?.portalId || "") === SIRVA_PORTAL_ID ||
  order?.companyName === "SIRVA WORLDWIDE RELO & MOVING";

const getPortalEmailList = (portal: any) =>
  portal?.notificationEmails || portal?.emails || [];

const notificationField = (type: "pickup" | "delivery") =>
  type === "pickup" ? "agentsPickupConfirmation" : "agentsDeliveryConfirmation";

const awaitingField = (type: "pickup" | "delivery") =>
  type === "pickup"
    ? "awaitingPickupConfirmation"
    : "awaitingDeliveryConfirmation";

/** One worker claims the send so other instances do not email the same list. */
const claimAgentNotification = async (
  orderId: string,
  type: "pickup" | "delivery",
) => {
  const field = notificationField(type);
  const awaiting = awaitingField(type);
  const claimed = await Order.findOneAndUpdate(
    {
      _id: orderId,
      [`notifications.${awaiting}`]: true,
      $or: [
        { [`notifications.${field}.sentAt`]: { $exists: false } },
        { [`notifications.${field}.sentAt`]: null },
      ],
    },
    {
      $set: {
        [`notifications.${awaiting}`]: false,
        [`notifications.${field}.status`]: NotificationStatus.Pending,
        [`notifications.${field}.sentAt`]: new Date(),
      },
    },
  );
  return Boolean(claimed);
};

const releaseAgentNotification = async (
  orderId: string,
  type: "pickup" | "delivery",
) => {
  const field = notificationField(type);
  const awaiting = awaitingField(type);
  await Order.findByIdAndUpdate(orderId, {
    $set: {
      [`notifications.${awaiting}`]: true,
      [`notifications.${field}.status`]: NotificationStatus.Failed,
      [`notifications.${field}.sentAt`]: null,
      [`notifications.${field}.failedAt`]: new Date(),
    },
  });
};

const sendPickupNotificationsForOrder = async (
  order: any,
  preserveFlags: boolean,
) => {
  const status = getOrderStatus(order);
  const awaitingPickup = Boolean(
    order?.notifications?.awaitingPickupConfirmation,
  );

  if (status === "invoiced" && !preserveFlags) {
    logger.info("Pickup notification skipped - invoiced status", {
      orderId: order._id,
      refId: order.refId,
      awaitingPickup,
      preserveFlags,
    });
    if (!preserveFlags && awaitingPickup) {
      if (!order.notifications) {
        order.notifications = {};
      }
      order.notifications.awaitingPickupConfirmation = false;
      await order.save();
    }
    return;
  }

  if (!preserveFlags && (status !== "picked_up" || !awaitingPickup)) {
    logger.info("Pickup notification skipped - status/flag mismatch", {
      orderId: order._id,
      refId: order.refId,
      status,
      awaitingPickup,
    });
    return;
  }

  const pickupDate = getPickupNotificationDate(order);
  if (!isWithinLast48Hours(pickupDate)) {
    logger.info("Pickup notification skipped - outside 48h window", {
      orderId: order._id,
      refId: order.refId,
      pickupDate: pickupDate ? new Date(pickupDate).toISOString() : null,
    });
    return;
  }

  const portal = await Portal.findById(order.portalId);
  if (!portal) {
    logger.warn("Pickup notification skipped - portal not found", {
      orderId: order._id,
      portalId: order.portalId,
    });
    return;
  }

  const portalIdString = String(order.portalId || portal?._id || "");
  const isMMI = MMI_PORTALS.includes(
    portalIdString as (typeof MMI_PORTALS)[number],
  );
  const portalEmails = isMMI
    ? [
        {
          email: "autodeskupdates@graebel.com",
          name: "Auto Desk",
          pickup: true,
          delivery: true,
        },
      ]
    : getPortalEmailList(portal);
  const isSirva = isSirvaOrder(order);
  const isSirvaNonDomestic = Boolean(order?.sirvaNonDomestic);
  const { agentRecipients, portalRecipients, recipients } =
    resolveAgentNotificationRecipients({
      agents: Array.isArray(order.agents) ? order.agents : [],
      portalEmails,
      type: "pickup",
      isSirva,
      isSirvaNonDomestic,
    });

  logger.info("Pickup notification recipients", {
    orderId: order._id,
    refId: order.refId,
    portalId: portalIdString,
    isMMI,
    isSirva,
    isSirvaNonDomestic,
    portalEmailCount: portalEmails.length,
    agentRecipients: agentRecipients.map((r) => r.email),
    portalRecipients: portalRecipients.map((r) => r.email),
    mergedRecipients: recipients.map((r) => r.email),
  });

  if (recipients.length === 0) {
    logger.info("No pickup notification recipients for order", {
      orderId: order._id,
      refId: order.refId,
    });
    if (!preserveFlags) {
      if (!order.notifications) {
        order.notifications = {};
      }
      order.notifications.awaitingPickupConfirmation = false;
      await order.save();
    }
    return;
  }

  if (!preserveFlags) {
    const claimed = await claimAgentNotification(order._id, "pickup");
    if (!claimed) {
      logger.info("Pickup notification skipped - already claimed", {
        orderId: order._id,
        refId: order.refId,
      });
      return;
    }
  }

  const results = await sendOrderPickupConfirmation({
    order,
    recipients,
  });

  if (!preserveFlags && !results.some((result) => result.success)) {
    await releaseAgentNotification(order._id, "pickup");
  }
};

const sendDeliveryNotificationsForOrder = async (
  order: any,
  preserveFlags: boolean,
) => {
  const status = getOrderStatus(order);
  const isDelivered = status === "delivered" || status === "invoiced";
  const awaitingDelivery = Boolean(
    order?.notifications?.awaitingDeliveryConfirmation,
  );

  if (!preserveFlags && (!isDelivered || !awaitingDelivery)) {
    logger.info("Delivery notification skipped - status/flag mismatch", {
      orderId: order._id,
      refId: order.refId,
      status,
      awaitingDelivery,
    });
    return;
  }

  const deliveryDate = getDeliveryNotificationDate(order);
  if (!isWithinLast48Hours(deliveryDate)) {
    logger.info("Delivery notification skipped - outside 48h window", {
      orderId: order._id,
      refId: order.refId,
      deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : null,
    });
    return;
  }

  const portal = await Portal.findById(order.portalId);
  if (!portal) {
    logger.warn("Delivery notification skipped - portal not found", {
      orderId: order._id,
      portalId: order.portalId,
    });
    return;
  }

  const portalIdString = String(order.portalId || portal?._id || "");
  const isMMI = MMI_PORTALS.includes(
    portalIdString as (typeof MMI_PORTALS)[number],
  );
  const portalEmails = isMMI
    ? [
        {
          email: "autodeskupdates@graebel.com",
          name: "Auto Desk",
          pickup: true,
          delivery: true,
        },
      ]
    : getPortalEmailList(portal);
  const isSirva = isSirvaOrder(order);
  const isSirvaNonDomestic = Boolean(order?.sirvaNonDomestic);
  const { agentRecipients, portalRecipients, recipients } =
    resolveAgentNotificationRecipients({
      agents: Array.isArray(order.agents) ? order.agents : [],
      portalEmails,
      type: "delivery",
      isSirva,
      isSirvaNonDomestic,
    });

  logger.info("Delivery notification recipients", {
    orderId: order._id,
    refId: order.refId,
    portalId: portalIdString,
    isMMI,
    isSirva,
    isSirvaNonDomestic,
    portalEmailCount: portalEmails.length,
    agentRecipients: agentRecipients.map((r) => r.email),
    portalRecipients: portalRecipients.map((r) => r.email),
    mergedRecipients: recipients.map((r) => r.email),
  });

  if (recipients.length === 0) {
    logger.info("No delivery notification recipients for order", {
      orderId: order._id,
      refId: order.refId,
    });
    if (!preserveFlags) {
      if (!order.notifications) {
        order.notifications = {};
      }
      order.notifications.awaitingDeliveryConfirmation = false;
      await order.save();
    }
    return;
  }

  if (!preserveFlags) {
    const claimed = await claimAgentNotification(order._id, "delivery");
    if (!claimed) {
      logger.info("Delivery notification skipped - already claimed", {
        orderId: order._id,
        refId: order.refId,
      });
      return;
    }
  }

  const results = await sendOrderDeliveryConfirmation({
    order,
    recipients,
  });

  if (!preserveFlags && !results.some((result) => result.success)) {
    await releaseAgentNotification(order._id, "delivery");
  }
};

export const sendPickupDeliveryNotifications = async (
  options: { preserveFlags?: boolean } = {},
) => {
  const preserveFlags = Boolean(options.preserveFlags);
  const cutoffDate = getCutoffDate();
  const recentDateCutoff = new Date(Date.now() - HOURS_48_MS);
  const overrideEmail = process.env.NOTIFICATION_OVERRIDE_EMAIL;
  logger.info("Notification run options", {
    preserveFlags,
    cutoffDate: cutoffDate.toISOString(),
    recentDateCutoff: recentDateCutoff.toISOString(),
    overrideEmail: overrideEmail || null,
  });

  const pickupOrders = await Order.find({
    "notifications.awaitingPickupConfirmation": true,
    updatedAt: { $gt: cutoffDate },
    $and: [
      {
        $or: [
          {
            "notifications.agentsPickupConfirmation.sentAt": { $exists: false },
          },
          { "notifications.agentsPickupConfirmation.sentAt": null },
        ],
      },
      {
        $or: [
          { "schedule.pickupCompleted": { $gte: recentDateCutoff } },
          { "schedule.pickupEstimated.0": { $gte: recentDateCutoff } },
          { "schedule.pickupSelected": { $gte: recentDateCutoff } },
        ],
      },
    ],
  });
  logger.info("Pickup notification candidates", {
    count: pickupOrders.length,
    cutoffDate: cutoffDate.toISOString(),
    recentDateCutoff: recentDateCutoff.toISOString(),
    preserveFlags,
  });

  for (const order of pickupOrders) {
    try {
      await sendPickupNotificationsForOrder(order, preserveFlags);
    } catch (error) {
      logger.error("Pickup notification failed for order", {
        orderId: order._id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const deliveryOrders = await Order.find({
    "notifications.awaitingDeliveryConfirmation": true,
    updatedAt: { $gt: cutoffDate },
    $and: [
      {
        $or: [
          {
            "notifications.agentsDeliveryConfirmation.sentAt": {
              $exists: false,
            },
          },
          { "notifications.agentsDeliveryConfirmation.sentAt": null },
        ],
      },
      {
        $or: [
          { "schedule.deliveryCompleted": { $gte: recentDateCutoff } },
          { "schedule.deliveryEstimated.0": { $gte: recentDateCutoff } },
        ],
      },
    ],
  });
  logger.info("Delivery notification candidates", {
    count: deliveryOrders.length,
    cutoffDate: cutoffDate.toISOString(),
    recentDateCutoff: recentDateCutoff.toISOString(),
    preserveFlags,
  });

  for (const order of deliveryOrders) {
    try {
      await sendDeliveryNotificationsForOrder(order, preserveFlags);
    } catch (error) {
      logger.error("Delivery notification failed for order", {
        orderId: order._id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
