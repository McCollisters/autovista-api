/**
 * In-memory per-order caps for public customer share emails.
 * Complements IP rate limits; resets on process restart (acceptable for abuse control).
 */

type Counter = { count: number; windowStartMs: number };

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_SHARES_PER_ORDER_PER_DAY = 5;

const counters = new Map<string, Counter>();

export function canSendCustomerOrderShare(orderId: string): boolean {
  const key = String(orderId);
  const now = Date.now();
  const existing = counters.get(key);

  if (!existing || now - existing.windowStartMs >= WINDOW_MS) {
    counters.set(key, { count: 1, windowStartMs: now });
    return true;
  }

  if (existing.count >= MAX_SHARES_PER_ORDER_PER_DAY) {
    return false;
  }

  existing.count += 1;
  return true;
}

/** Test helper */
export function _resetCustomerOrderShareCountersForTests(): void {
  counters.clear();
}
