// Initialize dotenv FIRST (side-effect import runs immediately)
import "dotenv/config";

import express from "express";
import mongoose from "mongoose";

// Import configuration and utilities
import { config } from "./config/index.js";
import { logger } from "./core/logger.js";
import { ErrorHandler } from "./_global/errorHandler.js";

// Import security middleware
import {
  helmetConfig,
  corsConfig,
  generalRateLimit,
  requestLogger,
  securityHeaders,
  securityErrorHandler,
} from "./core/middleware/security.js";

// Import routes
import portalRoutes from "./portal/routes.js";
import userRoutes from "./user/routes.js";
import quoteRoutes from "./quote/routes.js";
import orderRoutes from "./order/routes.js";
import healthRoutes from "./presentation/routes/health.js";

// Import models
import { Order } from "./order/schema.js";
import { Quote } from "./quote/schema.js";

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
