/**
 * Canonical customer email for public order lookup / share — matches portal
 * OrderStatusDetail: customerEmail || email (trimmed, lowercased for comparison).
 */
export function resolveOrderCustomerEmailForTracking(order: {
  customer?: { email?: string; customerEmail?: string } | null;
}): string {
  const c = order.customer;
  if (!c) return "";
  return String(c.customerEmail || c.email || "")
    .trim()
    .toLowerCase();
}
