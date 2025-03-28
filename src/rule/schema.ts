import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { Status, USState } from "../_global/enums"; 

export enum RuleType {
    Markup = "markup",
    Discount = "discount",
    LocationModifier = "location_modifier",
    Minimum = "minimum",
    Override = "override"
}

export enum ValueType {
    Percentage = "percentage",
    Fixed = "fixed",
}

export interface IRule extends Document {
    ruleName: string;
    description: string;
    ruleStatus: Status,
    ruleType: RuleType;
    valueType: ValueType;
    value: number; 
    origin?: USState;
    destination?: USState;
    portalId?: Types.ObjectId;
}

const ruleSchema = new Schema<IRule>(
    {
        ruleName: { type: String, required: true, trim: true },
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
        origin: { type: String, trim: true, enum: Object.values(USState) },
        destination: { type: String, trim: true, enum: Object.values(USState) },
        portalId: { type: Schema.Types.ObjectId, ref: 'Portal' }
    },
    { timestamps: true }
);
  
const Rule: Model<IRule> = mongoose.model<IRule>("Rule", ruleSchema);
export { Rule };