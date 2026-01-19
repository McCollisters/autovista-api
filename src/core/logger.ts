import winston from "winston";
import os from "os";
import { PapertrailTransport } from "winston-papertrail";
import { config } from "@/config/index";

// Create logs directory if it doesn't exist
import { mkdirSync } from "fs";
import { dirname } from "path";

const logDir = "logs";
try {
  mkdirSync(logDir, { recursive: true });
} catch (error) {
  // Directory might already exist, ignore error
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint(),
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: "HH:mm:ss",
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return msg;
  }),
);

const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: config.nodeEnv === "development" ? consoleFormat : logFormat,
  }),

  // File transports
  new winston.transports.File({
    filename: `${logDir}/error.log`,
    level: "error",
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  new winston.transports.File({
    filename: `${logDir}/combined.log`,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

const papertrailHost = process.env.PAPERTRAIL_HOST;
const papertrailPort = Number(process.env.PAPERTRAIL_PORT);
const papertrailLevel =
  process.env.PAPERTRAIL_LEVEL ||
  (config.nodeEnv === "development" ? "debug" : "info");
const papertrailProgram =
  process.env.PAPERTRAIL_APP_NAME || `autovista-api-${config.nodeEnv}`;

if (papertrailHost && Number.isFinite(papertrailPort)) {
  transports.push(
    new PapertrailTransport({
      host: papertrailHost,
      port: papertrailPort,
      hostname: os.hostname(),
      program: papertrailProgram,
      level: papertrailLevel,
      logFormat: (level, message) => `${level}: ${message}`,
    }) as unknown as winston.transport,
  );
}

// Create the logger
export const logger = winston.createLogger({
  level: config.nodeEnv === "development" ? "debug" : "info",
  format: logFormat,
  defaultMeta: { service: "autovista-api" },
  transports,
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: `${logDir}/exceptions.log` }),
  ],

  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: `${logDir}/rejections.log` }),
  ],
});

// Create a stream for Morgan HTTP logging
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Helper functions for common logging patterns
export const logRequest = (req: any, res: any, next: any) => {
  logger.info("Incoming request", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  next();
};

export const logError = (error: Error, context?: any) => {
  logger.error("Application error", {
    message: error.message,
    stack: error.stack,
    context,
  });
};

export const logDatabaseOperation = (
  operation: string,
  collection: string,
  details?: any,
) => {
  logger.debug("Database operation", {
    operation,
    collection,
    details,
  });
};
