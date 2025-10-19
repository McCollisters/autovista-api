import mongoose, { Document, Types, Schema } from "mongoose";
import { createSchema, createReferenceField } from "../_global/schemas/factory";

export interface IResponse {
  questionId: Types.ObjectId;
  answer: string | number;
}

export interface ISurveyResponse extends Document {
  userId: Types.ObjectId;
  surveyId: Types.ObjectId;
  responses: IResponse[];
}

const questionResponseSchema = createSchema<IResponse>({
  questionId: { type: Types.ObjectId, required: true },
  answer: { type: Schema.Types.Mixed, required: true },
});

const surveyResponseSchema = createSchema<ISurveyResponse>({
  userId: createReferenceField("User", true),
  surveyId: createReferenceField("Survey", true),
  responses: [questionResponseSchema],
});

// Model is exported from model.ts file
export { surveyResponseSchema };
