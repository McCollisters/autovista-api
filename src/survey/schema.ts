import mongoose, { Document } from "mongoose";
import { createSchema, createStatusField } from "../_global/schemas/factory";
import { Status } from "../_global/enums";

export enum QuestionType {
  Rating = "rating",
  OpenEnd = "open_end",
}

export interface IQuestion {
  questionText: string;
  type: QuestionType;
}

export interface ISurvey extends Document {
  description?: string;
  status: Status;
  questions: IQuestion[];
}

const questionSchema = createSchema<IQuestion>({
  questionText: { type: String, required: true },
  type: { type: String, required: true, enum: Object.values(QuestionType) },
});

const surveySchema = createSchema<ISurvey>({
  description: { type: String },
  status: createStatusField(Status, true),
  questions: { type: [questionSchema], default: [] },
});

// Model is exported from model.ts file
export { surveySchema };
