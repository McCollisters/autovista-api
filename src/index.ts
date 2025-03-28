import mongoose from "mongoose";
import dotenv from "dotenv";
import express from "express";
import portalRoutes from "./portal/routes";

dotenv.config(); 

const app = express();
const port: number = parseInt(process.env.PORT || "3050", 10);

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_PROD_URI as string, {
      useNewUrlParser: true
    } as mongoose.ConnectOptions);

    console.log(`Connected to MongoDB ${process.env.NODE_ENV} DB`);

    app.use("/portal", portalRoutes);

    app.listen(port, () => {
      console.log(`Listening on ${port}`);
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1); 
  }
};

// Start the server
startServer();