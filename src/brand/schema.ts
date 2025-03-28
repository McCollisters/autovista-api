import mongoose, { Schema, Document, Model } from 'mongoose';

export enum VehicleClass {
  Sedan = "sedan",
  SUV = "suv",
  Van = "van",
  PU_4Door = "pu-4door",
  PU_2Door = "pu-2door",
}

export interface IModel {
  model: string;
  class: VehicleClass;
}

export interface IBrand extends Document {
  brand: string;
  models: IModel[]; 
}

const modelSchema = new Schema<IModel>({
  model: { type: String, required: true },
  class: { type: String, required: true, enum: Object.values(VehicleClass) }
});

const brandSchema = new Schema<IBrand>(
  {
    brand: { type: String, required: true },
    models: [modelSchema],
  },
  { timestamps: true }
);

const Brand: Model<IBrand> = mongoose.model<IBrand>("Brand", brandSchema);

export { Brand };