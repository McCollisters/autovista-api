import mongoose, { Schema, Document } from 'mongoose';

interface IModel {
  model: string;
  pricingClass: string;
}

interface IBrand extends Document {
  brand: string;
  models: IModel[];
}

const brandSchema: Schema = new Schema(
  {
    brand: { type: String, required: true },
    models: [
      {
        model: { type: String, required: true },
        class: { type: String, required: true },
      },
    ],
  },
  { timestamps: true } 
);


const Brand = mongoose.model<IBrand>('Brand', brandSchema);

export { Brand, brandSchema };
