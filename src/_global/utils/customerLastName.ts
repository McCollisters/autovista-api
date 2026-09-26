/**
 * Normalize and extract a customer last name for quote verification.
 */

export function normalizePersonNamePart(value: string): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Prefer structured customer.lastName; otherwise use the last word of full name.
 */
export function resolveCustomerLastName(customer: {
  lastName?: string | null;
  name?: string | null;
} | null | undefined): string | null {
  if (!customer) {
    return null;
  }

  const structured = normalizePersonNamePart(String(customer.lastName || ""));
  if (structured) {
    return structured;
  }

  const fullName = normalizePersonNamePart(String(customer.name || ""));
  if (!fullName) {
    return null;
  }

  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  return parts[parts.length - 1];
}

/**
 * Exact last-name match (case/whitespace insensitive).
 */
export function customerLastNameMatches(
  customer: { lastName?: string | null; name?: string | null } | null | undefined,
  providedLastName: string,
): boolean {
  const expected = resolveCustomerLastName(customer);
  const provided = normalizePersonNamePart(providedLastName);
  return Boolean(expected && provided && expected === provided);
}
