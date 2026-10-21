type NotificationType = "pickup" | "delivery";

type AgentSource = {
  email?: string;
  name?: string;
  pickup?: boolean;
  delivery?: boolean;
  enablePickupNotifications?: boolean;
  enableDeliveryNotifications?: boolean;
  emailPickUp?: boolean;
  emailDelivery?: boolean;
};

type PortalEmailSource = {
  email?: string;
  name?: string;
  pickup?: boolean;
  delivery?: boolean;
  sirvanondomestic?: boolean;
  sirvadomestic?: boolean;
};

export type AgentNotificationRecipient = {
  email: string;
  name?: string;
};

const emailKey = (email: string) => email.trim().toLowerCase();

/**
 * Order agents opt in with enablePickupNotifications / enableDeliveryNotifications.
 * Older orders used pickup / delivery or emailPickUp / emailDelivery.
 */
const agentWantsNotification = (agent: AgentSource, type: NotificationType) => {
  if (type === "pickup") {
    if (typeof agent.enablePickupNotifications === "boolean") {
      return agent.enablePickupNotifications;
    }
    if (typeof agent.pickup === "boolean") {
      return agent.pickup;
    }
    if (typeof agent.emailPickUp === "boolean") {
      return agent.emailPickUp;
    }
    return false;
  }

  if (typeof agent.enableDeliveryNotifications === "boolean") {
    return agent.enableDeliveryNotifications;
  }
  if (typeof agent.delivery === "boolean") {
    return agent.delivery;
  }
  if (typeof agent.emailDelivery === "boolean") {
    return agent.emailDelivery;
  }
  return false;
};

const portalWantsNotification = (
  entry: PortalEmailSource,
  type: NotificationType,
  isSirva: boolean,
  isSirvaNonDomestic: boolean,
) => {
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
};

const normalizeRecipients = (
  entries: Array<{ email?: string; name?: string }>,
): AgentNotificationRecipient[] =>
  entries
    .map((entry) => ({
      email: entry.email ? String(entry.email).trim() : "",
      name: entry.name,
    }))
    .filter((entry) => Boolean(entry.email));

/** One email per address. Agents are listed first so their name is kept. */
const mergeRecipients = (
  agents: AgentNotificationRecipient[],
  portal: AgentNotificationRecipient[],
) => {
  const seen = new Set<string>();
  const recipients: AgentNotificationRecipient[] = [];

  for (const entry of [...agents, ...portal]) {
    const key = emailKey(entry.email);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    recipients.push(entry);
  }

  return recipients;
};

/**
 * Pickup and delivery recipients are the union of:
 * - portal notification emails with that option enabled
 * - order agents who asked for that notification
 * The same address in both places is sent once.
 */
export const resolveAgentNotificationRecipients = ({
  agents = [],
  portalEmails = [],
  type,
  isSirva = false,
  isSirvaNonDomestic = false,
}: {
  agents?: AgentSource[];
  portalEmails?: PortalEmailSource[];
  type: NotificationType;
  isSirva?: boolean;
  isSirvaNonDomestic?: boolean;
}): {
  agentRecipients: AgentNotificationRecipient[];
  portalRecipients: AgentNotificationRecipient[];
  recipients: AgentNotificationRecipient[];
} => {
  const agentRecipients = normalizeRecipients(
    agents.filter((agent) => agent && agentWantsNotification(agent, type)),
  );
  const portalRecipients = normalizeRecipients(
    portalEmails.filter((entry) =>
      portalWantsNotification(entry, type, isSirva, isSirvaNonDomestic),
    ),
  );

  return {
    agentRecipients,
    portalRecipients,
    recipients: mergeRecipients(agentRecipients, portalRecipients),
  };
};
