/**
 * Encrypted tokens for order-status email prefilling.
 *
 * Confirmation emails link to the customer portal with an opaque token instead
 * of a raw email query param. The frontend exchanges the token for an email
 * via GET /api/v1/order/status-prefill.
 *
 * Tokens use AES-256-GCM so the email is not readable from the URL (unlike a
 * plain JWT, whose payload is only base64-encoded).
 */

import crypto from "crypto";
import { logger } from "@/core/logger";

export const ORDER_STATUS_PREFILL_PURPOSE = "order-status-prefill";

/** Prefill links remain usable for the typical transport lifecycle. */
export const ORDER_STATUS_PREFILL_TTL_MS = 180 * 24 * 60 * 60 * 1000;

type PrefillTokenPayload = {
  purpose: typeof ORDER_STATUS_PREFILL_PURPOSE;
  email: string;
  exp: number;
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

/**
 * Create an opaque encrypted token that can later be resolved to an email.
 */
export function createOrderStatusPrefillToken(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Email is required to create a prefill token");
  }

  const payload: PrefillTokenPayload = {
    purpose: ORDER_STATUS_PREFILL_PURPOSE,
    email: normalizedEmail,
    exp: Date.now() + ORDER_STATUS_PREFILL_TTL_MS,
  };

  const iv = crypto.randomBytes(12);
  const key = deriveKey(getSecret());
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

/**
 * Verify a prefill token and return the embedded email, or null if invalid.
 */
export function verifyOrderStatusPrefillToken(
  token: string,
): { email: string } | null {
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
    const payload = JSON.parse(decrypted.toString("utf8")) as Partial<PrefillTokenPayload>;

    if (
      payload.purpose !== ORDER_STATUS_PREFILL_PURPOSE ||
      typeof payload.email !== "string" ||
      !payload.email.trim() ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
      return null;
    }

    return { email: payload.email.trim().toLowerCase() };
  } catch (error) {
    logger.warn("Invalid order status prefill token", {
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}
