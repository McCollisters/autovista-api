import mongoose, { Schema, Document, Model } from "mongoose";
import { Status } from "../_global/enums"; 

export enum QuestionType {
    Rating = "rating",
    OpenEnd = "open_end"
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

const questionSchema = new Schema<IQuestion>({
  questionText: { type: String, required: true },
  type: { type: String, required: true, enum: Object.values(QuestionType) },
}, { _id: true });

const surveySchema = new Schema<ISurvey>(
    {
      description: { type: String },
      status: { type: String, required: true, enum: Object.values(Status), default: Status.Active },
      questions: { type: [questionSchema], default: [] },
    },
    { timestamps: true }
  );
  
  const Survey: Model<ISurvey> = mongoose.model<ISurvey>("Survey", surveySchema);
  export { Survey };