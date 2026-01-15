import { Document, Schema } from "mongoose";
import { createSchema, createReferenceField } from "../_global/schemas/factory";

export interface ISurveyResponse extends Document {
  email?: string;
  portal?: Schema.Types.ObjectId;
  portalName?: string;
  order?: Schema.Types.ObjectId;
  orderId?: number;
  orderDelivery?: string;
  rating?: number;
  explanation?: string;
  question?: Schema.Types.ObjectId;
}

const surveyResponseSchema = createSchema<ISurveyResponse>(
  {
    email: { type: String },
    portal: createReferenceField("Portal", false),
    portalName: { type: String },
    order: createReferenceField("Order", false),
    orderId: { type: Number },
    orderDelivery: { type: String },
    rating: { type: Number },
    explanation: { type: String },
    question: createReferenceField("SurveyQuestion", false),
  },
  { collection: "surveyresponses" },
);

// Model is exported from model.ts file
export { surveyResponseSchema };
