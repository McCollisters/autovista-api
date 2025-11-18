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
  generalRateLimit,
  requestLogger,
  securityHeaders,
  securityErrorHandler,
} from "@/core/middleware/security";

// Import routes
import portalRoutes from "@/portal/routes";
import userRoutes from "@/user/routes";
import quoteRoutes from "@/quote/routes";
import orderRoutes from "@/order/routes";
import notificationRoutes from "@/notification/routes";
import authRoutes from "@/auth/routes";
import integrationRoutes from "@/integration/routes";
import settingsRoutes from "@/settings/routes";
import surveyRoutes from "@/survey/routes";
import healthRoutes from "@/presentation/routes/health";

// Import webhook system
import webhookRouter from "@/_global/integrations/webhooks/registry";
import callbackRouter from "@/_global/integrations/webhooks/callbacks";
import {
  initializeWebhooks,
  validateWebhookConfig,
} from "@/_global/integrations/webhooks";

// Import models
import { Order, Quote } from "@/_global/models";

// Import AWS SQS
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// Initialize Express app
const app = express();

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
    validateWebhookConfig();
    initializeWebhooks();

    //  sendMessage();

    // Clear existing data (development only)
    if (config.nodeEnv === "development") {
      await Order.deleteMany({});
      await Quote.deleteMany({});
      logger.info("Cleared existing orders and quotes for development");
    }

    // Apply security middleware
    app.use(helmetConfig);
    app.use(corsConfig);
    app.use(securityHeaders);
    app.use(requestLogger);
    app.use(generalRateLimit);

    // Body parsing middleware
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Health check routes (before other routes)
    app.use("/", healthRoutes);

    // API routes
    app.use("/api/v1/portal", portalRoutes);
    app.use("/api/v1/user", userRoutes);
    app.use("/api/v1/quote", quoteRoutes);
    app.use("/api/v1/order", orderRoutes);
    app.use("/api/v1/notifications", notificationRoutes);
    app.use("/api/v1/auth", authRoutes);
    app.use("/api/v1/integration", integrationRoutes);
    app.use("/api/v1/settings", settingsRoutes);
    app.use("/api/v1/surveys", surveyRoutes);

    // Integration routes (legacy paths for backward compatibility)
    import { signS3, getFile, captivatedCallback } from "@/integration/routes";
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
