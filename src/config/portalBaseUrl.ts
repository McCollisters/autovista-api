const PRODUCTION_PORTAL = "https://autovista.mccollisters.com";

const stripTrailingSlash = (url: string) => url.replace(/\/$/, "");

/**
 * First non-localhost, non-production-portal HTTPS origin from ALLOWED_ORIGINS
 * (comma-separated). Used as a staging fallback when NODE_ENV is "staging".
 */
const pickStagingOriginFromAllowedOrigins = (): string | null => {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) return null;
  const prodNorm = PRODUCTION_PORTAL.toLowerCase();
  const parts = raw.split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
  for (const o of parts) {
    const lower = o.toLowerCase();
    if (lower.startsWith("http://localhost") || lower.startsWith("https://localhost")) {
      continue;
    }
    if (lower === prodNorm) continue;
    if (o.startsWith("http://") || o.startsWith("https://")) {
      return o;
    }
  }
  return null;
};

/**
 * Public customer portal base URL for links in emails (no trailing slash).
 *
 * Resolution order:
 * 1. PUBLIC_APP_URL or PORTAL_BASE_URL (set this on Elastic Beanstalk when the portal URL
 *    differs from production, e.g. staging CloudFront).
 * 2. NODE_ENV development or test → http://localhost:3000
 * 3. NODE_ENV staging → STAGING_PUBLIC_APP_URL, else first suitable ALLOWED_ORIGINS entry,
 *    else BASE_URL, else production portal.
 * 4. Otherwise → production portal.
 */
export const getPortalBaseUrl = (): string => {
  const explicit =
    process.env.PUBLIC_APP_URL?.trim() || process.env.PORTAL_BASE_URL?.trim();
  if (explicit) {
    return stripTrailingSlash(explicit);
  }

  const nodeEnv = process.env.NODE_ENV || "development";
  if (nodeEnv === "development" || nodeEnv === "test") {
    return "http://localhost:3000";
  }

  if (nodeEnv === "staging") {
    const staging = process.env.STAGING_PUBLIC_APP_URL?.trim();
    if (staging) return stripTrailingSlash(staging);
    const fromAllowed = pickStagingOriginFromAllowedOrigins();
    if (fromAllowed) return fromAllowed;
    const baseUrl = process.env.BASE_URL?.trim();
    if (baseUrl) return stripTrailingSlash(baseUrl);
  }

  return PRODUCTION_PORTAL;
};
