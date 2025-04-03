import express, { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import portalRoutes from "./portal/routes";
import userRoutes from "./user/routes";
import quoteRoutes from "./quote/routes";

import { ErrorHandler } from "./_global/errorHandler";

import { ModifierSet } from "./modifierSet/schema";
import { Quote } from "./quote/schema";

dotenv.config(); 

const app = express();
const port: number = parseInt(process.env.PORT || "3050", 10);

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_DEV_URI as string, {
      useNewUrlParser: true
    } as mongoose.ConnectOptions);


    // await ModifierSet.deleteMany({});
    await Quote.deleteMany({})

    // const modifierSet = new ModifierSet({
    //     isGlobal: true,
    //     inoperable: {
    //       value: 150,
    //       valueType: "flat",
    //       modifierType: "markup"
    //     },
    //     routes: [
    //       {
    //         value: 15,
    //         valueType: "flat",
    //         modifierType: "markup",
    //         origin: "AZ",
    //         destination: "CA"
    //       }
    //     ]
    // });

    // await modifierSet.save();
    

    // const portalModifierSet = new ModifierSet({
    //   isGlobal: false,
    //   portalId: "67e6e8d9b42f71574a8be063",
    //   fixedCommission: {
    //     value: 100,
    //     valueType: "flat",
    //     modifierType: "markup"
    //   },
    //   companyTariff: {
    //     value: 12,
    //     valueType: "percentage",
    //     modifierType: "markup"
    //   },
    //   inoperable: {
    //     value: 250,
    //     valueType: "flat",
    //     modifierType: "markup"
    //   },
    //   fuel: {
    //     value: 75,
    //     valueType: "flat",
    //     modifierType: "markup"
    //   },
    //   irr: {
    //     value: 50,
    //     valueType: "flat",
    //     modifierType: "markup"
    //   },
    //   discount: {
    //     value: 5,
    //     valueType: "flat",
    //     modifierType: "percentage"
    //   },
    //   oversize: {
    //     value: 50,
    //     valueType: "flat",
    //     modifierType: "markup"
    //   }
    // });

    // await portalModifierSet.save()
      



  
    app.use(express.json()); 
    app.use("/portal", portalRoutes);
    app.use("/user", userRoutes);
    app.use("/quote", quoteRoutes);


    app.use(ErrorHandler);

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