export interface FormatTransportTypeLabelOptions {
  /** When value is missing or blank (default `"Open"`). Use `""` for pickup/delivery templates. */
  whenEmpty?: string;
}

/**
 * Human-readable transport type for emails (order/quote notifications).
 * Maps enum values (`open` / `enclosed` / `whiteglove`) and common variants; avoids legacy bugs from
 * `charAt(0) + slice(1) || "Open"` (NaN/empty → wrong "Open").
 */
export function formatTransportTypeLabel(
  value: unknown,
  options?: FormatTransportTypeLabelOptions,
): string {
  const whenEmpty = options?.whenEmpty ?? "Open";
  const raw = String(value ?? "").trim();
  if (!raw) {
    return whenEmpty;
  }

  const compact = raw.toLowerCase().replace(/[\s_-]+/g, "");

  if (compact === "whiteglove") {
    return "White Glove";
  }
  if (compact === "enclosed" || compact.includes("enclosed")) {
    return "Enclosed";
  }
  if (compact === "open") {
    return "Open";
  }

  const spaced = raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
  const titled = spaced
    .split(/\s+/)
    .map((word) =>
      word
        ? `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`
        : "",
    )
    .join(" ")
    .trim();

  return titled || whenEmpty;
}
