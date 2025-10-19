import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
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

    if (config.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn("CORS blocked request from origin", { origin });
    return callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["X-Total-Count", "X-Page-Count"],
});

// Rate limiting configuration
export const createRateLimit = (
  windowMs: number,
  max: number,
  message?: string,
) => {
  return rateLimit({
    windowMs,
    max,
    message: message || {
      error: "Too many requests from this IP, please try again later.",
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req: Request, res: Response) => {
      logger.warn("Rate limit exceeded", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        url: req.url,
        method: req.method,
      });

      res.status(429).json({
        error: "Too many requests from this IP, please try again later.",
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
};

// General API rate limiting (100 requests per 15 minutes)
export const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  "Too many requests from this IP, please try again later.",
);

// Strict rate limiting for auth endpoints (5 requests per 15 minutes)
export const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 requests per windowMs
  "Too many authentication attempts from this IP, please try again later.",
);

// Strict rate limiting for quote/order creation (10 requests per 15 minutes)
export const createRateLimitStrict = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  10, // limit each IP to 10 requests per windowMs
  "Too many creation requests from this IP, please try again later.",
);

// Request logging middleware
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startTime = Date.now();

  // Log the request
  logger.info("Incoming request", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    contentLength: req.get("Content-Length"),
  });

  // Override res.end to log response
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
