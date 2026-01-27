// Initialize dotenv FIRST (side-effect import runs immediately)
import "dotenv/config";

import express from "express";
import mongoose from "mongoose";

// Import configuration and utilities
import { config } from "@/config/index";
import { logger } from "@/core/logger";
import { ErrorHandler } from "@/_global/errorHandler";

// Import security middleware
import {
  helmetConfig,
  corsConfig,
  requestLogger,
  securityHeaders,
  noCacheHeaders,
  securityErrorHandler,
} from "@/core/middleware/security";

// Import routes
import portalRoutes from "@/portal/routes";
import { getPortals } from "@/portal/controllers/getPortals";
import userRoutes from "@/user/routes";
import { getUsers } from "@/user/controllers/getUsers";
import quoteRoutes from "@/quote/routes";
import { getQuotes } from "@/quote/controllers/getQuotes";
import orderRoutes from "@/order/routes";
import { getOrders } from "@/order/controllers/getOrders";
import { exportOrders } from "@/order/controllers/exportOrders";
import notificationRoutes from "@/notification/routes";
import authRoutes from "@/auth/routes";
import integrationRoutes from "@/integration/routes";
import settingsRoutes from "@/settings/routes";
import surveyRoutes from "@/survey/routes";
import emailRoutes from "@/email/routes";
import healthRoutes from "@/presentation/routes/health";
import { signS3, getFile, captivatedCallback } from "@/integration/routes";
import brandRoutes from "@/brand/routes";
import { getMakes } from "@/brand/controllers/getMakes";
import modifierSetRoutes from "@/modifierSet/routes";
import { getModifierSets } from "@/modifierSet/controller";

// Import webhook system
import webhookRouter from "@/_global/integrations/webhooks/registry";
import callbackRouter from "@/_global/integrations/webhooks/callbacks";
import {
  initializeWebhooks,
  validateWebhookConfig,
} from "@/_global/integrations/webhooks";

// Import cron jobs
import { initializeCronJobs } from "@/core/cron";

// Import models
import { Order, Quote } from "@/_global/models";

// Import AWS SQS
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// Initialize Express app
const app = express();

// Trust proxy to get real client IP from CloudFront
// CloudFront sets X-Forwarded-For header with the original client IP
app.set("trust proxy", true);

// Initialize SQS client
const sqs = new SQSClient({ region: config.aws.region });

const sendMessage = async () => {
  const params = {
    QueueUrl: config.aws.sqs.queueUrl,
    MessageBody: JSON.stringify({
      type: "user_signup",
      userId: "abc123",
      delivery: "immediate",
    }),
    MessageGroupId: "user-notifications",
    MessageDeduplicationId: Date.now().toString(),
  };

  try {
    const data = await sqs.send(new SendMessageCommand(params));
    logger.info("SQS message sent successfully", { messageId: data.MessageId });
  } catch (err) {
    logger.error("Error sending SQS message", {
      error: err instanceof Error ? err.message : err,
    });
  }
};

const startServer = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("Connected to MongoDB successfully");

    // Initialize webhook system
    // validateWebhookConfig();
    // initializeWebhooks();

    // Initialize cron jobs (skip in staging or when explicitly disabled)
    if (
      config.nodeEnv !== "staging" &&
      process.env.DISABLE_CRON_JOBS !== "true"
    ) {
      initializeCronJobs();
    } else {
      logger.info("Cron jobs disabled", {
        environment: config.nodeEnv,
        disableFlag: process.env.DISABLE_CRON_JOBS || "false",
      });
    }

    //  sendMessage();

    // Clear existing data (development only)
    // DISABLED: This was wiping all orders and quotes on server restart
    // if (config.nodeEnv === "development") {
    //   await Order.deleteMany({});
    //   await Quote.deleteMany({});
    //   logger.info("Cleared existing orders and quotes for development");
    // }

    // Apply security middleware
    app.use(helmetConfig);
    app.use(corsConfig);
    app.use(securityHeaders);
    app.use(noCacheHeaders); // Prevent CloudFront from caching API responses
    app.use(requestLogger);
    // Rate limiting is handled by CloudFront

    // Body parsing middleware
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Health check routes (before other routes)
    app.use("/", healthRoutes);

    // API routes
    app.use("/api/v1/portal", portalRoutes);
    // Portals listing endpoint (plural)
    app.get("/api/v1/portals", getPortals);
    app.use("/api/v1/user", userRoutes);
    // Users listing endpoint (plural)
    app.get("/api/v1/users", getUsers);
    app.use("/api/v1/quote", quoteRoutes);
    // Quotes listing endpoint (plural)
    app.get("/api/v1/quotes", getQuotes);

    // Log registered routes for debugging
    logger.info("API routes registered", {
      routes: [
        "GET /api/v1/user (current user)",
        "GET /api/v1/users (list users)",
        "GET /api/v1/user/:userId",
        "POST /api/v1/user",
        "PATCH /api/v1/user/:userId",
        "DELETE /api/v1/user/:userId",
      ],
    });
    app.use("/api/v1/order", orderRoutes);
    // Orders listing endpoint (plural)
    app.get("/api/v1/orders", getOrders);
    // Orders export endpoint (plural, to match frontend)
    app.post("/api/v1/orders/export", exportOrders);
    app.use("/api/v1/notifications", notificationRoutes);
    app.use("/api/v1/auth", authRoutes);
    app.use("/api/v1/integration", integrationRoutes);
    app.use("/api/v1/settings", settingsRoutes);
    app.use("/api/v1/surveys", surveyRoutes);
    app.use("/api/v1/survey", surveyRoutes);
    app.use("/api/v1/emails", emailRoutes);
    app.use("/api/v1/brand", brandRoutes);
    // Brands listing endpoint (plural)
    app.get("/api/v1/brands", getMakes);
    app.use("/api/v1/modifierSet", modifierSetRoutes);
    // ModifierSets listing endpoint (plural)
    app.get("/api/v1/modifierSets", getModifierSets);

    // Integration routes (legacy paths for backward compatibility)
    app.post("/sign_s3", signS3);
    app.get("/get_file/:fileKey", getFile);
    app.post("/captivated/callback", captivatedCallback);

    // Webhook routes
    app.use("/api/v1/webhooks", webhookRouter);

    // Super Dispatch callback routes (for backward compatibility)
    app.use("/callback", callbackRouter);

    // Security error handler
    app.use(securityErrorHandler);

    // Global error handler
    app.use(ErrorHandler);

    // Start server
    app.listen(config.port, () => {
      logger.info(`Server started successfully`, {
        port: config.port,
        environment: config.nodeEnv,
        nodeVersion: process.version,
      });
    });
  } catch (error) {
    logger.error("Failed to start server", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
};

startServer();

export { app };
