import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { logger } from "@/core/logger";

const router = Router();

// Basic health check
router.get("/health", async (req: Request, res: Response) => {
  try {
    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "2.0.0",
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
    };

    logger.info("Health check requested", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });
    res.status(200).json(health);
  } catch (error) {
    logger.error("Health check failed", {
      error: error instanceof Error ? error.message : error,
    });
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Health check failed",
    });
  }
});

// Detailed health check with database connectivity
router.get("/health/detailed", async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Check database connection
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? "connected" : "disconnected";

    // Test database query
    let dbResponseTime = 0;
    let dbTestPassed = false;

    if (dbState === 1 && mongoose.connection.db) {
      const dbStartTime = Date.now();
      try {
        await mongoose.connection.db.admin().ping();
        dbResponseTime = Date.now() - dbStartTime;
        dbTestPassed = true;
      } catch (error) {
        logger.error("Database ping failed", {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    const health = {
      status: dbTestPassed ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "2.0.0",
      responseTime: Date.now() - startTime,
      services: {
        database: {
          status: dbStatus,
          responseTime: dbResponseTime,
          connectionState: dbState,
        },
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid,
      },
    };

    const statusCode = dbTestPassed ? 200 : 503;
    logger.info("Detailed health check requested", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      status: health.status,
      dbStatus: dbStatus,
    });

    res.status(statusCode).json(health);
  } catch (error) {
    logger.error("Detailed health check failed", {
      error: error instanceof Error ? error.message : error,
    });
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Health check failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
