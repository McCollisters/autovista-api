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
