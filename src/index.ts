import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import portalRoutes from "./portal/routes";
import userRoutes from "./user/routes";
import quoteRoutes from "./quote/routes";
import orderRoutes from "./order/routes";
import { ErrorHandler } from "./_global/errorHandler";

dotenv.config();

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
