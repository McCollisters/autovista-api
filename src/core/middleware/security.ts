import helmet from "helmet";
import cors from "cors";
import { Request, Response, NextFunction } from "express";
import { config } from "@/config/index";
import { logger } from "@/core/logger";

// Helmet configuration for security headers
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable if you need to embed resources
});

// CORS configuration
export const corsConfig = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.trim().replace(/\/$/, "");
    if (config.allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    logger.warn("CORS blocked request from origin", { origin: normalizedOrigin });
    return callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["X-Total-Count", "X-Page-Count"],
});

// Rate limiting is handled by CloudFront
// Removed express-rate-limit middleware - using CloudFront rate limiting instead

/** Set LOG_HTTP_REQUESTS=false to disable general API access logs (webhooks still log). */
export const isHttpRequestLoggingEnabled = (): boolean =>
  process.env.LOG_HTTP_REQUESTS !== "false";

const pathOnly = (url: string): string => url.split("?")[0];

const isHealthProbePath = (url: string): boolean => {
  const path = pathOnly(url);
  return (
    path === "/health" ||
    path === "/health/detailed" ||
    path.endsWith("/health")
  );
};

/** ELB/K8s probes — never log (dominates Papertrail volume). */
export const shouldSkipRequestAccessLog = (req: Request): boolean => {
  if (isHealthProbePath(req.url)) {
    return true;
  }

  const userAgent = req.get("User-Agent") || "";
  if (
    userAgent.includes("ELB-HealthChecker") ||
    userAgent.includes("HealthChecker") ||
    userAgent.includes("kube-probe")
  ) {
    return true;
  }

  return false;
};

/** Super Dispatch / Acertus callbacks — logged by requestLogger. */
export const isWebhookCallbackPath = (url: string): boolean =>
  pathOnly(url).startsWith("/callback");

/** Registry webhooks — logged by webhookLogger (skip duplicate in requestLogger). */
export const isRegistryWebhookApiPath = (url: string): boolean =>
  pathOnly(url).startsWith("/api/v1/webhooks");

export const shouldLogHttpRequest = (req: Request): boolean => {
  if (shouldSkipRequestAccessLog(req)) {
    return false;
  }
  if (isWebhookCallbackPath(req.url) || isRegistryWebhookApiPath(req.url)) {
    return true;
  }
  return isHttpRequestLoggingEnabled();
};

// Request logging middleware
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (isRegistryWebhookApiPath(req.url)) {
    return next();
  }

  if (!shouldLogHttpRequest(req)) {
    return next();
  }

  const startTime = Date.now();

  logger.info("Incoming request", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    contentLength: req.get("Content-Length"),
  });

  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any): any {
    const duration = Date.now() - startTime;

    logger.info("Request completed", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Security headers middleware
export const securityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Remove X-Powered-By header
  res.removeHeader("X-Powered-By");

  // Add custom security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  next();
};

// Cache control middleware - prevents CloudFront from caching API responses
export const noCacheHeaders = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Only apply to API routes
  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("X-Cache-Control", "no-cache"); // Additional header for CloudFront
  }

  next();
};

// Error handling for security middleware
export const securityErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err.message === "Not allowed by CORS") {
    logger.warn("CORS error", {
      origin: req.get("Origin"),
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    return res.status(403).json({
      error: "CORS policy violation",
      message: "This origin is not allowed to access this resource",
    });
  }

  next(err);
};
