import rateLimit from "express-rate-limit";

/**
 * Proxies that append to X-Forwarded-For before Node sees the request:
 * CloudFront, the load balancer, and the instance nginx proxy.
 *
 * `trust proxy: true` would take the leftmost header value, which a client can
 * spoof to get a fresh rate-limit bucket. express-rate-limit rejects that
 * setting. A hop count keeps req.ip on the viewer.
 */
export const TRUST_PROXY_HOPS = 3;

/**
 * App-level rate limits for intentionally public endpoints.
 * CloudFront may also rate-limit; these protect abuse of share/lookup flows.
 */

const standardHandler = (_req: any, res: any) => {
  res.status(429).json({
    message: "Too many requests. Please try again later.",
  });
};

/**
 * Combined cap for quote share, order share, and customer share.
 * These routes share one limiter, so this is the hourly total per IP.
 */
export const SHARE_EMAIL_RATE_LIMIT_MAX = 500;

/** Quote/order share email (agent or customer). */
export const shareEmailRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: SHARE_EMAIL_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
});

/** Customer find / status prefill token exchange. */
export const publicLookupRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
});
