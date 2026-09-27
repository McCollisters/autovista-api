import { logger } from "@/core/logger";

/**
 * Hosted Converge payment URL for COD emails.
 * Prefer full URL; otherwise build from token. Never hardcode secrets in source.
 */
export function getCodPaymentHostedUrl(): string {
  const fullUrl = String(process.env.CONVERGE_HOSTED_PAYMENT_URL || "").trim();
  if (fullUrl) {
    return fullUrl;
  }

  const token = String(process.env.CONVERGE_TXN_AUTH_TOKEN || "").trim();
  if (token) {
    return `https://www.convergepay.com/hosted-payments?ssl_txn_auth_token=${encodeURIComponent(token)}`;
  }

  logger.warn(
    "COD payment URL not configured (set CONVERGE_HOSTED_PAYMENT_URL or CONVERGE_TXN_AUTH_TOKEN)",
  );
  return "";
}

/**
 * Hosted checkout link for an unpaid COD order. Empty when the order is not
 * COD, already paid, or the payment URL is not configured.
 */
export function codPaymentUrlForOrder(order: {
  paymentType?: string | null;
  hasPaid?: boolean | null;
  paid?: boolean | null;
} | null | undefined): string {
  if (!order) {
    return "";
  }
  const isCod = String(order.paymentType || "").toLowerCase() === "cod";
  const isPaid = order.hasPaid === true || order.paid === true;
  if (!isCod || isPaid) {
    return "";
  }
  return getCodPaymentHostedUrl();
}

/** JSON body for an order response, plus the COD checkout link when one applies. */
export function orderPayloadWithCodPaymentUrl(order: any): any {
  const payload =
    order && typeof order.toJSON === "function" ? order.toJSON() : order;
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  const codPaymentUrl = codPaymentUrlForOrder(payload);
  if (codPaymentUrl) {
    payload.codPaymentUrl = codPaymentUrl;
  }
  return payload;
}
