import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import {
  createOrderStatusPrefillToken,
  createQuoteEmailPrefillToken,
  verifyOrderStatusPrefillToken,
  QUOTE_EMAIL_PREFILL_PURPOSE,
} from "@/_global/utils/orderStatusPrefillToken";
import crypto from "crypto";

jest.mock("@/core/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("orderStatusPrefillToken", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-jwt-secret-for-prefill-tokens";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it("creates a token that resolves back to a normalized email", () => {
    const token = createOrderStatusPrefillToken("  Customer@Example.COM ");
    const result = verifyOrderStatusPrefillToken(token);

    expect(result).toEqual({ email: "customer@example.com" });
  });

  it("creates quote prefill tokens that resolve the same way", () => {
    const token = createQuoteEmailPrefillToken("Quote.User@Example.COM");
    expect(verifyOrderStatusPrefillToken(token)).toEqual({
      email: "quote.user@example.com",
    });
  });

  it("does not expose the email in the token string", () => {
    const email = "customer@example.com";
    const token = createOrderStatusPrefillToken(email);

    expect(token.toLowerCase()).not.toContain("customer");
    expect(token.toLowerCase()).not.toContain("example");
    expect(Buffer.from(token, "base64url").toString("utf8")).not.toContain(
      email,
    );
  });

  it("rejects tokens encrypted with a different secret", () => {
    const token = createOrderStatusPrefillToken("customer@example.com");
    process.env.JWT_SECRET = "different-secret";

    expect(verifyOrderStatusPrefillToken(token)).toBeNull();
  });

  it("rejects tampered tokens", () => {
    const token = createOrderStatusPrefillToken("customer@example.com");
    const raw = Buffer.from(token, "base64url");
    raw[raw.length - 1] ^= 0xff;

    expect(verifyOrderStatusPrefillToken(raw.toString("base64url"))).toBeNull();
  });

  it("rejects expired tokens", () => {
    const key = crypto
      .createHash("sha256")
      .update(process.env.JWT_SECRET as string)
      .digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(
      JSON.stringify({
        purpose: QUOTE_EMAIL_PREFILL_PURPOSE,
        email: "customer@example.com",
        exp: Date.now() - 1000,
      }),
      "utf8",
    );
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const token = Buffer.concat([iv, tag, encrypted]).toString("base64url");

    expect(verifyOrderStatusPrefillToken(token)).toBeNull();
  });

  it("rejects empty email when creating a token", () => {
    expect(() => createOrderStatusPrefillToken("   ")).toThrow(
      "Email is required to create a prefill token",
    );
  });
});
