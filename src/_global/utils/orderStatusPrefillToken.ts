/**
 * Encrypted tokens for email prefilling from outbound links.
 *
 * Used so confirmation/quote emails can link into the customer portal without
 * putting a raw email address (or confirmation code) in the URL. The frontend
 * exchanges the token via GET /api/v1/order/status-prefill.
 *
 * Tokens use AES-256-GCM so the payload is not readable from the URL (unlike a
 * plain JWT, whose payload is only base64-encoded).
 */

import crypto from "crypto";
import { logger } from "@/core/logger";

export const ORDER_STATUS_PREFILL_PURPOSE = "order-status-prefill";
export const QUOTE_EMAIL_PREFILL_PURPOSE = "quote-email-prefill";

const ALLOWED_PREFILL_PURPOSES = new Set<string>([
  ORDER_STATUS_PREFILL_PURPOSE,
  QUOTE_EMAIL_PREFILL_PURPOSE,
]);

/** Order-status portal links remain usable through a typical transport lifecycle. */
export const ORDER_STATUS_PREFILL_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Quote email links: quote validity (~10 days) plus a short buffer. */
export const QUOTE_EMAIL_PREFILL_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type PrefillTokenPayload = {
  purpose: string;
  email: string;
  exp: number;
  /** Quote confirmation code — encrypted in quote-email tokens only. */
  code?: string;
  quoteId?: string;
  /** Bound order id for order-status tokens. */
  orderId?: string;
};

export type PrefillTokenResult = {
  email: string;
  code?: string;
  quoteId?: string;
  orderId?: string;
};

export type QuoteEmailPrefillOptions = {
  code?: string;
  quoteId?: string;
};

export type OrderStatusPrefillOptions = {
  orderId?: string;
};

function getSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || "";
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

function ttlForPurpose(purpose: string): number {
  if (purpose === QUOTE_EMAIL_PREFILL_PURPOSE) {
    return QUOTE_EMAIL_PREFILL_TTL_MS;
  }
  return ORDER_STATUS_PREFILL_TTL_MS;
}

function createEmailPrefillToken(
  email: string,
  purpose: string,
  extras?: QuoteEmailPrefillOptions & OrderStatusPrefillOptions,
): string {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Email is required to create a prefill token");
  }
  if (!ALLOWED_PREFILL_PURPOSES.has(purpose)) {
    throw new Error(`Unsupported prefill token purpose: ${purpose}`);
  }

  const payload: PrefillTokenPayload = {
    purpose,
    email: normalizedEmail,
    exp: Date.now() + ttlForPurpose(purpose),
  };

  const code = String(extras?.code || "").trim();
  if (code) {
    payload.code = code;
  }
  const quoteId = String(extras?.quoteId || "").trim();
  if (quoteId) {
    payload.quoteId = quoteId;
  }
  const orderId = String(extras?.orderId || "").trim();
  if (orderId) {
    payload.orderId = orderId;
  }

  const iv = crypto.randomBytes(12);
  const key = deriveKey(getSecret());
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

/**
 * Create an opaque encrypted token for order-status email autofill.
 */
export function createOrderStatusPrefillToken(
  email: string,
  options?: OrderStatusPrefillOptions,
): string {
  return createEmailPrefillToken(email, ORDER_STATUS_PREFILL_PURPOSE, options);
}

/**
 * Create an opaque encrypted token for quote email autofill/verification.
 * Optionally embeds confirmation code + quoteId so deep links need no PII/code query params.
 */
export function createQuoteEmailPrefillToken(
  email: string,
  options?: QuoteEmailPrefillOptions,
): string {
  return createEmailPrefillToken(email, QUOTE_EMAIL_PREFILL_PURPOSE, options);
}

/**
 * Verify a prefill token and return the embedded fields, or null if invalid.
 */
export function verifyOrderStatusPrefillToken(
  token: string,
): PrefillTokenResult | null {
  try {
    if (!token || typeof token !== "string") {
      return null;
    }

    const raw = Buffer.from(token, "base64url");
    // iv (12) + tag (16) + ciphertext (at least 1)
    if (raw.length < 29) {
      return null;
    }

    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const key = deriveKey(getSecret());
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    const payload = JSON.parse(
      decrypted.toString("utf8"),
    ) as Partial<PrefillTokenPayload>;

    if (
      typeof payload.purpose !== "string" ||
      !ALLOWED_PREFILL_PURPOSES.has(payload.purpose) ||
      typeof payload.email !== "string" ||
      !payload.email.trim() ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
      return null;
    }

    const result: PrefillTokenResult = {
      email: payload.email.trim().toLowerCase(),
    };

    if (typeof payload.code === "string" && payload.code.trim()) {
      result.code = payload.code.trim();
    }
    if (typeof payload.quoteId === "string" && payload.quoteId.trim()) {
      result.quoteId = payload.quoteId.trim();
    }
    if (typeof payload.orderId === "string" && payload.orderId.trim()) {
      result.orderId = payload.orderId.trim();
    }

    return result;
  } catch (error) {
    logger.warn("Invalid email prefill token", {
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}
