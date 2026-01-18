import { logger } from "@/core/logger";
import { Order, Portal } from "@/_global/models";
import { sendOrderPickupConfirmation } from "@/order/notifications/sendOrderPickupConfirmation";
import { sendOrderDeliveryConfirmation } from "@/order/notifications/sendOrderDeliveryConfirmation";
import { MMI_PORTALS } from "@/_global/constants/portalIds";

const SIRVA_PORTAL_ID = "5e99f0b420e68d5f479d7317";
const DEFAULT_CUTOFF_DATE = new Date("2024-05-20");

type NotificationType = "pickup" | "delivery";

const getCutoffDate = () => {
  const envDate = process.env.NOTIFICATION_CUTOFF_DATE;
  if (!envDate) {
    return DEFAULT_CUTOFF_DATE;
  }
  const parsed = new Date(envDate);
  return Number.isNaN(parsed.getTime()) ? DEFAULT_CUTOFF_DATE : parsed;
};

const getOrderStatus = (order: any) =>
  String(order?.tms?.status || order?.sdStatus || "").toLowerCase();

const isSirvaOrder = (order: any) =>
  String(order?.portalId || "") === SIRVA_PORTAL_ID ||
  order?.companyName === "SIRVA WORLDWIDE RELO & MOVING";

const getPortalEmailList = (portal: any) =>
  (portal?.notificationEmails ||
    portal?.emails ||
    []) as Array<{
    email?: string;
    name?: string;
    pickup?: boolean;
    delivery?: boolean;
    sirvanondomestic?: boolean;
    sirvadomestic?: boolean;
  }>;

const agentWantsNotification = (agent: any, type: NotificationType) => {
  if (!agent) {
    return false;
  }
  if (type === "pickup") {
    return Boolean(
      agent.pickup ??
        agent.enablePickupNotifications ??
        agent.emailPickUp ??
        false,
    );
  }
  return Boolean(
    agent.delivery ??
      agent.enableDeliveryNotifications ??
      agent.emailDelivery ??
      false,
  );
};

const filterPortalRecipients = (
  portalEmails: ReturnType<typeof getPortalEmailList>,
  type: NotificationType,
  isSirva: boolean,
  isSirvaNonDomestic: boolean,
) => {
  return portalEmails.filter((entry) => {
    if (type === "pickup" && !entry.pickup) {
      return false;
    }
    if (type === "delivery" && !entry.delivery) {
      return false;
    }
    if (!isSirva) {
      return true;
    }
    if (isSirvaNonDomestic) {
      return Boolean(entry.sirvanondomestic);
    }
    return Boolean(entry.sirvadomestic);
  });
};

const normalizeRecipients = (
  entries: Array<{ email?: string; name?: string }>,
) =>
  entries
    .map((entry) => ({
      email: entry.email ? String(entry.email).trim() : "",
      name: entry.name,
    }))
    .filter((entry) => Boolean(entry.email));

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

  logger.info("Pickup notification portal context", {
    orderId: order._id,
    refId: order.refId,
    portalId: portalIdString,
    isMMI,
    isSirva,
    isSirvaNonDomestic,
    portalEmailCount: portalEmails.length,
  });

  const portalRecipients = normalizeRecipients(
    filterPortalRecipients(portalEmails, "pickup", isSirva, isSirvaNonDomestic),
  );

  const sentPortalEmails = new Set(
    portalRecipients.map((recipient) => recipient.email.toLowerCase()),
  );

  logger.info("Pickup notification recipients", {
    orderId: order._id,
    refId: order.refId,
    portalRecipients: portalRecipients.map((recipient) => recipient.email),
  });

  if (portalRecipients.length > 0) {
    await sendOrderPickupConfirmation({
      order,
      recipients: portalRecipients,
    });
  }

  const agentRecipients = normalizeRecipients(
    Array.isArray(order.agents)
      ? order.agents
          .filter((agent: any) => agentWantsNotification(agent, "pickup"))
          .filter((agent: any) => {
            const email = String(agent?.email || "").toLowerCase();
            return email && !sentPortalEmails.has(email);
          })
      : [],
  );

  logger.info("Pickup notification agent recipients", {
    orderId: order._id,
    refId: order.refId,
    agentRecipients: agentRecipients.map((recipient) => recipient.email),
  });

  if (agentRecipients.length > 0) {
    await sendOrderPickupConfirmation({
      order,
      recipients: agentRecipients,
    });
  }

  const legacyAgentEmail = String(order?.agent?.agentEmail || "").trim();
  if (legacyAgentEmail) {
    logger.info("Pickup notification legacy agent", {
      orderId: order._id,
      refId: order.refId,
      legacyAgentEmail,
    });
  }
  if (legacyAgentEmail && !sentPortalEmails.has(legacyAgentEmail.toLowerCase())) {
    await sendOrderPickupConfirmation({
      order,
      recipients: [
        {
          email: legacyAgentEmail,
          name: order?.agent?.agentFullName || undefined,
        },
      ],
    });
  }

  if (
    portalRecipients.length === 0 &&
    agentRecipients.length === 0 &&
    (!legacyAgentEmail || sentPortalEmails.has(legacyAgentEmail.toLowerCase()))
  ) {
    logger.info("No pickup notification recipients for order", {
      orderId: order._id,
      refId: order.refId,
    });
  }

  if (!preserveFlags) {
    if (!order.notifications) {
      order.notifications = {};
    }
    order.notifications.awaitingPickupConfirmation = false;
    await order.save();
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

  logger.info("Delivery notification portal context", {
    orderId: order._id,
    refId: order.refId,
    portalId: portalIdString,
    isMMI,
    isSirva,
    isSirvaNonDomestic,
    portalEmailCount: portalEmails.length,
  });

  const portalRecipients = normalizeRecipients(
    filterPortalRecipients(portalEmails, "delivery", isSirva, isSirvaNonDomestic),
  );

  const sentPortalEmails = new Set(
    portalRecipients.map((recipient) => recipient.email.toLowerCase()),
  );

  logger.info("Delivery notification recipients", {
    orderId: order._id,
    refId: order.refId,
    portalRecipients: portalRecipients.map((recipient) => recipient.email),
  });

  if (portalRecipients.length > 0) {
    await sendOrderDeliveryConfirmation({
      order,
      recipients: portalRecipients,
    });
  }

  const agentRecipients = normalizeRecipients(
    Array.isArray(order.agents)
      ? order.agents
          .filter((agent: any) => agentWantsNotification(agent, "delivery"))
          .filter((agent: any) => {
            const email = String(agent?.email || "").toLowerCase();
            return email && !sentPortalEmails.has(email);
          })
      : [],
  );

  logger.info("Delivery notification agent recipients", {
    orderId: order._id,
    refId: order.refId,
    agentRecipients: agentRecipients.map((recipient) => recipient.email),
  });

  if (agentRecipients.length > 0) {
    await sendOrderDeliveryConfirmation({
      order,
      recipients: agentRecipients,
    });
  }

  const legacyAgentEmail = String(order?.agent?.agentEmail || "").trim();
  if (legacyAgentEmail) {
    logger.info("Delivery notification legacy agent", {
      orderId: order._id,
      refId: order.refId,
      legacyAgentEmail,
    });
  }
  if (legacyAgentEmail && !sentPortalEmails.has(legacyAgentEmail.toLowerCase())) {
    await sendOrderDeliveryConfirmation({
      order,
      recipients: [
        {
          email: legacyAgentEmail,
          name: order?.agent?.agentFullName || undefined,
        },
      ],
    });
  }

  if (
    portalRecipients.length === 0 &&
    agentRecipients.length === 0 &&
    (!legacyAgentEmail || sentPortalEmails.has(legacyAgentEmail.toLowerCase()))
  ) {
    logger.info("No delivery notification recipients for order", {
      orderId: order._id,
      refId: order.refId,
    });
  }

  if (!preserveFlags) {
    if (!order.notifications) {
      order.notifications = {};
    }
    order.notifications.awaitingDeliveryConfirmation = false;
    await order.save();
  }
};

export const sendPickupDeliveryNotifications = async (
  options: { preserveFlags?: boolean } = {},
) => {
  const preserveFlags = Boolean(options.preserveFlags);
  const cutoffDate = getCutoffDate();
  const overrideEmail = process.env.NOTIFICATION_OVERRIDE_EMAIL;
  logger.info("Notification run options", {
    preserveFlags,
    cutoffDate: cutoffDate.toISOString(),
    overrideEmail: overrideEmail || null,
  });

  const pickupOrders = await Order.find({
    "notifications.awaitingPickupConfirmation": true,
    updatedAt: { $gt: cutoffDate },
  });
  logger.info("Pickup notification candidates", {
    count: pickupOrders.length,
    cutoffDate: cutoffDate.toISOString(),
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
  });
  logger.info("Delivery notification candidates", {
    count: deliveryOrders.length,
    cutoffDate: cutoffDate.toISOString(),
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
