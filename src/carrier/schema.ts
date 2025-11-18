import mongoose, { Document, Types } from "mongoose";
import { createSchema } from "../_global/schemas/factory";
import { Status } from "../_global/enums";

export interface ICarrierActivity {
  type: string;
  date: Date;
  notes?: string;
}

export interface ICarrier extends Document {
  name: string;
  email?: string;
  guid?: string;
  status: string;
  activity: ICarrierActivity[];
}

const carrierSchema = createSchema<ICarrier>({
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true },
  guid: { type: String, trim: true },
  status: { type: String, default: Status.Active },
  activity: [
    {
      type: { type: String, required: true },
      date: { type: Date, required: true },
      notes: { type: String },
    },
  ],
});

// Model is exported from model.ts file
export { carrierSchema };

