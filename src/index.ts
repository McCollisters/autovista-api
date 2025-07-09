import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import portalRoutes from "./portal/routes.js";
import userRoutes from "./user/routes.js";
import quoteRoutes from "./quote/routes.js";
import orderRoutes from "./order/routes.js";
import { ErrorHandler } from "./_global/errorHandler.js";
import { Order } from "./order/schema.js";
import { Quote } from "./quote/schema.js";

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
const sqs = new SQSClient({ region: "us-east-1" });
dotenv.config();
const app = express();
const port: number = parseInt(process.env.PORT || "8080", 10);

const sendMessage = async () => {
  const params = {
    QueueUrl:
      "https://sqs.us-east-1.amazonaws.com/016551391727/notifications-immediate.fifo",
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
    console.log("Message sent:", data.MessageId);
  } catch (err) {
    console.error("Error sending message:", err);
  }
};

const startServer = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_DEV_URI as string,
      {
        useNewUrlParser: true,
      } as mongoose.ConnectOptions,
    );

    //  sendMessage();

    await Order.deleteMany({});
    await Quote.deleteMany({});

    app.use(express.json());
    app.use("/portal", portalRoutes);
    app.use("/user", userRoutes);
    app.use("/quote", quoteRoutes);
    app.use("/order", orderRoutes);

    app.use(ErrorHandler);

    app.listen(port, () => {
      console.log(`Listening on ${port}`);
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

startServer();
