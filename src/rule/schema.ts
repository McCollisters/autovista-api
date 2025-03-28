import mongoose, { Schema, Document, Model } from 'mongoose';
import { Status } from "../_global/enums"; 

export enum RuleType {
    Markup = "markup",
    Discount = "discount",
    LocationModifier = "location_modifier",
    Minimum = "minimum"
}

export enum ValueType {
    Percentage = "percentage",
    Fixed = "fixed",
}

export interface IRule extends Document {
    description: string;
    ruleStatus: Status,
    ruleType: RuleType;
    valueType: ValueType;
    value: number; 
    origin?: string;
    destination?: string;
}

const ruleSchema = new Schema<IRule>(
    {
        description: { type: String, required: true, trim: true },
        ruleStatus: { type: String, required: true, enum: Object.values(Status) },
        ruleType: { 
            type: String,
            required: true,
            enum: Object.values(RuleType)
        },
        valueType: {
            type: String,
            required: true,
            enum: Object.values(ValueType),
        },
        value: {
            type: Number,
            required: true,
        },
        origin: { type: String, trim: true },
        destination: { type: String, trim: true },
    },
    { timestamps: true }
);
  
const Rule: Model<IRule> = mongoose.model<IRule>("Rule", ruleSchema);
export { Rule };