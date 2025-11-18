import mongoose, { Document } from "mongoose";
import { createSchema } from "../_global/schemas/factory";

export interface ITransitTime {
  minMiles: number;
  maxMiles: number;
  minDays: number;
  maxDays: number;
}

export interface IServiceLevel {
  name: string;
  value: string;
  markup: number;
}

export interface ISettings extends Document {
  transitTimes: ITransitTime[];
  holidays: Date[];
  quoteExpirationDays: number;
  serviceLevels: IServiceLevel[];
  updatedAt?: Date;
}

const settingsSchema = createSchema<ISettings>(
  {
    transitTimes: [
      {
        minMiles: { type: Number, required: true },
        maxMiles: { type: Number, required: true },
        minDays: { type: Number, required: true },
        maxDays: { type: Number, required: true },
      },
    ],
    holidays: [{ type: Date }],
    quoteExpirationDays: { type: Number, default: 10 },
    serviceLevels: [
      {
        name: { type: String, required: true },
        value: { type: String, required: true },
        markup: { type: Number, required: true },
      },
    ],
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false, // We're managing updatedAt manually
  },
);

// Model is exported from model.ts file
export { settingsSchema };

