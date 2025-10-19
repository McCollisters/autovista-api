import mongoose, { Document } from "mongoose";
import { createSchema } from "../_global/schemas/factory";
import { VehicleClass } from "../_global/enums";

export interface IModel {
  model: string;
  class: VehicleClass;
}

export interface IBrand extends Document {
  brand: string;
  models: IModel[];
}

const modelSchema = createSchema<IModel>({
  model: { type: String, required: true },
  class: { type: String, required: true, enum: Object.values(VehicleClass) },
});

const brandSchema = createSchema<IBrand>({
  brand: { type: String, required: true },
  models: [modelSchema],
});

// Model is exported from model.ts file
export { brandSchema };
