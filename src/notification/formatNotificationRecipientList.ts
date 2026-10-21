/** One entry per address, ignoring case. Drops blank values and the "unknown" placeholder. */
export const formatNotificationRecipientList = (recipients: string[]) => {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const recipient of recipients) {
    const email = String(recipient || "").trim();
    const key = email.toLowerCase();
    if (!email || key === "unknown" || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(email);
  }

  return unique.join(", ");
};
