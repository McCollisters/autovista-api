import mongoose, { Schema, Document, Types } from "mongoose";

export interface IResponse {
    questionId: Types.ObjectId; 
    answer: string | number; 
}
  
export interface ISurveyResponse extends Document {
    userId: Types.ObjectId;
    surveyId: Types.ObjectId;
    responses: IResponse[];
}
  
const questionResponseSchema = new Schema<IResponse>({
    questionId: { type: Schema.Types.ObjectId, required: true },
    answer: { type: Schema.Types.Mixed, required: true }, 
});
  
const surveyResponseSchema = new Schema<ISurveyResponse>(
    {
        userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
        surveyId: { type: Schema.Types.ObjectId, required: true, ref: "Survey" },
        responses: [questionResponseSchema],
    },
    { timestamps: true }
);

export const SurveyResponse = mongoose.model<ISurveyResponse>("SurveyResponse", surveyResponseSchema);
  