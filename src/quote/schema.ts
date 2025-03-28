import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { Status, USState, TransportType } from "../_global/enums"; 
import { Pricing, Vehicle } from "../_global/interfaces"; 

export interface IQuote extends Document {
    refId: string;
    status: Status;
    portalId: Types.ObjectId;
    userId: Types.ObjectId;
    origin: string;
    originValidated?: string;
    originState: USState;
    destination: string;
    destinationState: USState;
    destinationValidated?: string;
    miles: number;
    transportType: TransportType;
    customerName?: string; 
    vehicles: Array<Vehicle>;
    totalPricing: Pricing;
    archivedAt?: Date; 
}

const quoteSchema = new Schema<IQuote>(
    {
        refId: { type: String, required: true },
        status: { type: String, enum: Object.values(Status), required: true },
        portalId: { type: Schema.Types.ObjectId, ref: 'Portal', required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        origin: { type: String, required: true },
        originValidated: { type: String },
        destination: { type: String, required: true },
        destinationValidated: { type: String },
        miles: { type: Number, required: true },
        transportType: { type: String, enum: Object.values(TransportType), required: true },
        customerName: { type: String },
        vehicles: [
            {
                make: { type: String, required: true },
                model: { type: String, required: true },
                isOperable: { type: Boolean, required: true },
                pricing: {
                    base: { type: Number, required: true, default: 0 },
                    globalMarkups: {
                        inoperable: { type: Number, required: true, default: 0  },
                        oversize: { type: Number, required: true, default: 0  },
                    },
                    portalMarkups: {
                        commission: { type: Number, required: true, default: 0 },
                        companyTariff: { type: Number, required: true, default: 0  },
                    },
                },
            },
        ],
        archivedAt: { type: Date }
    },
    { timestamps: true }
  );
  
quoteSchema.set("toJSON", {
    virtuals: true,
});
  
const Quote: Model<IQuote> = mongoose.model<IQuote>("Quote", quoteSchema);
export { Quote };