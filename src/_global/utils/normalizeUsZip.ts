/**
 * Normalize a US ZIP code for storage and Super Dispatch.
 *
 * Leading zeros are often dropped by clients/forms (e.g. Livingston NJ
 * "07039" becomes "7039"). Super Dispatch requires a 5-digit zip, so we
 * pad short numeric zips. Values with letters (e.g. Canadian postcodes)
 * are left unchanged aside from trim.
 */
export function normalizeUsZip(
  value?: string | number | null,
): string {
  if (value == null || value === "") {
    return "";
  }

  const raw = String(value).trim();
  if (!raw) {
    return "";
  }

  // Non-US postal codes contain letters; do not coerce them.
  if (/[A-Za-z]/.test(raw)) {
    return raw;
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.length < 5) {
    return digits.padStart(5, "0");
  }

  // ZIP or ZIP+4 → first 5 digits
  return digits.slice(0, 5);
}
