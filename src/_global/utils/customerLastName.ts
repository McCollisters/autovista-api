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
 * Prefer structured customer.lastName; otherwise use the surname from the full name.
 * A trailing suffix such as Jr or III is not treated as the surname.
 */
export function resolveCustomerLastName(customer: {
  lastName?: string | null;
  name?: string | null;
} | null | undefined): string | null {
  if (!customer) {
    return null;
  }

  const structured = significantLastName(String(customer.lastName || ""));
  if (structured) {
    return structured;
  }

  return significantLastName(String(customer.name || ""));
}

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

function nameWords(value: string): string[] {
  return normalizePersonNamePart(value)
    .replace(/\./g, "")
    .split(" ")
    .filter(Boolean);
}

/** Drop a trailing generational suffix so "Smith Jr" compares as "smith". */
function withoutSuffixes(words: string[]): string[] {
  const result = [...words];
  while (
    result.length > 1 &&
    NAME_SUFFIXES.has(result[result.length - 1])
  ) {
    result.pop();
  }
  return result;
}

/**
 * Last significant name word. "Jane Smith Jr." and "Smith" both become "smith".
 */
export function significantLastName(value: string): string | null {
  const words = withoutSuffixes(nameWords(value));
  if (words.length === 0) {
    return null;
  }
  return words[words.length - 1];
}

/**
 * Last-name match, case and whitespace insensitive.
 * A generational suffix is ignored, and the comparison is the surname word,
 * so "Smith" matches "Jane Smith Jr" without matching a substring like "nathan".
 */
export function customerLastNameMatches(
  customer: { lastName?: string | null; name?: string | null } | null | undefined,
  providedLastName: string,
): boolean {
  const provided = significantLastName(providedLastName);
  if (!provided || !customer) {
    return false;
  }

  const structured = significantLastName(String(customer.lastName || ""));
  if (structured) {
    return structured === provided;
  }

  const fromName = significantLastName(String(customer.name || ""));
  return Boolean(fromName && fromName === provided);
}
