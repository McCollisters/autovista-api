import mongoose from "mongoose";
import dotenv from "dotenv";
import express from "express";
import portalRoutes from "./portal/routes";
import userRoutes from "./user/routes";

dotenv.config(); 

const app = express();
const port: number = parseInt(process.env.PORT || "3050", 10);

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_DEV_URI as string, {
      useNewUrlParser: true
    } as mongoose.ConnectOptions);

    console.log(`Connected to MongoDB`);

    app.use(express.json()); 

    app.use("/portal", portalRoutes);
    app.use("/user", userRoutes);

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