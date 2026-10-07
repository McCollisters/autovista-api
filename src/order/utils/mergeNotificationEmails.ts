type NotificationEmailEntry = {
  email?: string;
  name?: string;
  pickup?: boolean;
  delivery?: boolean;
  [key: string]: unknown;
};

type AgentNotificationSource = {
  email?: string;
  name?: string;
  pickup?: boolean;
  delivery?: boolean;
};

const emailKey = (email: unknown) =>
  String(email || "")
    .trim()
    .toLowerCase();

/**
 * Add order agents to a portal notification list without subscribing them.
 * Existing entries keep their pickup and delivery settings. New entries are
 * stored with both options off so they do not receive portal-wide emails
 * until someone turns those options on.
 */
export const mergeNotificationEmails = (
  existing: NotificationEmailEntry[] = [],
  agents: AgentNotificationSource[] = [],
): NotificationEmailEntry[] => {
  const byEmail = new Map<string, NotificationEmailEntry>();

  existing.forEach((entry) => {
    const email = emailKey(entry?.email);
    if (!email) return;
    byEmail.set(email, { ...entry });
  });

  agents.forEach((agent) => {
    const email = emailKey(agent?.email);
    if (!email || byEmail.has(email)) return;

    byEmail.set(email, {
      email: String(agent.email).trim(),
      ...(agent.name ? { name: agent.name } : {}),
      pickup: false,
      delivery: false,
    });
  });

  return Array.from(byEmail.values());
};
