import mongoose, { Document } from "mongoose";
import { createSchema } from "../_global/schemas/factory";

export interface IReport extends Document {
  // Add report fields here
  name?: string;
}

const reportSchema = createSchema<IReport>({
  name: { type: String },
});

export { reportSchema };
