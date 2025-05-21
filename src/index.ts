import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import portalRoutes from "./portal/routes.js";
import userRoutes from "./user/routes.js";
import quoteRoutes from "./quote/routes.js";
import orderRoutes from "./order/routes.js";
import { ErrorHandler } from "./_global/errorHandler.js";
import { PrismaClient } from "./generated/prisma";

dotenv.config();
const prisma = new PrismaClient();
const app = express();
const port: number = parseInt(process.env.PORT || "8080", 10);

const startServer = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_DEV_URI as string,
      {
        useNewUrlParser: true,
      } as mongoose.ConnectOptions,
    );

    const bob = await prisma.test.upsert({
      where: { name: "Bob" }, // look for Bob
      update: {}, // do nothing if found
      create: { name: "Bob" }, // create Bob if not found
    });

    console.log("✅ Inserted or found:", bob);

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
