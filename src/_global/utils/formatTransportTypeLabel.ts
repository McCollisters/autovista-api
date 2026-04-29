import { TransportType } from "@/_global/enums";

export interface FormatTransportTypeLabelOptions {
  /** When value is missing or blank (default `"Open"`). Use `""` for pickup/delivery templates. */
  whenEmpty?: string;
}

const DISPLAY_LABEL: Record<TransportType, string> = {
  [TransportType.Open]: "Open",
  [TransportType.Enclosed]: "Enclosed",
  [TransportType.WhiteGlove]: "White Glove",
};

function unwrapSelectLike(value: unknown): unknown {
  if (
    value !== null &&
    typeof value === "object" &&
    "value" in (value as Record<string, unknown>)
  ) {
    return (value as { value: unknown }).value;
  }
  return value;
}

/** Collapses spaces/underscores/hyphens so "White Glove", "white_glove", and "whiteglove" match. */
export function compactTransportTypeKey(value: unknown): string {
  return String(unwrapSelectLike(value) ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

/**
 * Infer enum from a compact key (same rules for DB save and email copy).
 * Only the three `TransportType` values are recognized, after spacing/case normalization
 * (e.g. "White Glove" → `whiteglove`). Anything else returns `null`.
 */
export function inferTransportTypeFromCompact(
  key: string,
): TransportType | null {
  if (!key) {
    return null;
  }
  if (key === "whiteglove") {
    return TransportType.WhiteGlove;
  }
  if (key === "enclosed") {
    return TransportType.Enclosed;
  }
  if (key === "open") {
    return TransportType.Open;
  }
  return null;
}

/**
 * Normalizes request/quote transport strings to the persisted `TransportType` enum.
 * Uses the same rules as order email display so saved orders match what customers see.
 */
export function normalizeTransportTypeToEnum(value: unknown): TransportType {
  return (
    inferTransportTypeFromCompact(compactTransportTypeKey(value)) ??
    TransportType.Open
  );
}

/**
 * Canonical transport for an order document (for emails and display).
 * Uses `transportType` on the order; if `schedule.serviceLevel` is white glove, that wins
 * when the booking is a white-glove move (covers legacy rows where `transportType` was wrong).
 */
export function resolveOrderTransportTypeEnum(order: {
  transportType?: unknown;
  schedule?: { serviceLevel?: unknown };
}): TransportType {
  const slKey = compactTransportTypeKey(order.schedule?.serviceLevel);
  if (slKey === "whiteglove") {
    return TransportType.WhiteGlove;
  }
  return (
    inferTransportTypeFromCompact(
      compactTransportTypeKey(order.transportType),
    ) ?? TransportType.Open
  );
}

export function formatTransportTypeLabelForOrder(
  order: {
    transportType?: unknown;
    schedule?: { serviceLevel?: unknown };
  },
  options?: FormatTransportTypeLabelOptions,
): string {
  return formatTransportTypeLabel(
    resolveOrderTransportTypeEnum(order),
    options,
  );
}

export function isOrderWhiteGlove(order: {
  transportType?: unknown;
  schedule?: { serviceLevel?: unknown };
}): boolean {
  return resolveOrderTransportTypeEnum(order) === TransportType.WhiteGlove;
}

/**
 * Human-readable transport type for emails (order/quote notifications).
 * Uses the same compact inference as order persistence so labels match stored intent.
 */
export function formatTransportTypeLabel(
  value: unknown,
  options?: FormatTransportTypeLabelOptions,
): string {
  const whenEmpty = options?.whenEmpty ?? "Open";
  const raw = String(unwrapSelectLike(value) ?? "").trim();
  if (!raw) {
    return whenEmpty;
  }

  const inferred = inferTransportTypeFromCompact(compactTransportTypeKey(raw));
  if (inferred !== null) {
    return DISPLAY_LABEL[inferred];
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
