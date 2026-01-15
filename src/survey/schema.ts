import { Document } from "mongoose";
import { createSchema } from "../_global/schemas/factory";

export interface ISurvey extends Document {
  question?: string;
  isScale?: boolean;
  order?: number;
  hasExplanation?: boolean;
}

const surveySchema = createSchema<ISurvey>(
  {
    question: { type: String },
    isScale: { type: Boolean },
    order: { type: Number },
    hasExplanation: { type: Boolean },
  },
  { collection: "surveyquestions" },
);

// Model is exported from model.ts file
export { surveySchema };
