import mongoose, { Document } from "mongoose";
import { createSchema } from "../_global/schemas/factory";
import { VehicleClass } from "../_global/enums";

export interface IModel {
  model: string;
  pricingClass: string; // Vehicle pricing class (e.g., "sedan", "suv", "van", etc.)
}

export interface IBrand extends Document {
  make: string; // Vehicle make (e.g., "Ford", "Toyota")
  models: IModel[];
}

const modelSchema = createSchema<IModel>({
  model: { type: String, required: true },
  pricingClass: { type: String, required: true }, // String to match mc_portal_api structure
});

const brandSchema = createSchema<IBrand>({
  make: { type: String, required: true },
  models: [modelSchema],
});

// Add index for faster lookups
brandSchema.index({ make: 1 });

// Model is exported from model.ts file
export { brandSchema };
