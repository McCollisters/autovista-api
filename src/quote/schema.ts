import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { Status, USState, TransportType, ServiceLevelOption } from "../_global/enums"; 

// Need to think through how to organize service levels, totals, vehicle breakdown, etc.
export interface ServiceLevelMarkups {
    serviceLevelOption: ServiceLevelOption;
    value: number; 
}

export interface GlobalMarkups {
    total: number;
    inoperable: number;
    oversize: number;
    serviceLevels: ServiceLevelMarkups;
}

export interface PortalMarkups {
    total: number;
    commission: number;
    companyTariff: number;
}0

export interface TotalByServiceLevel {
    serviceLevelOption: ServiceLevelOption;
    total: number;
}

export interface Pricing {
    base: number;
    globalMarkups: GlobalMarkups;
    portalMarkups: PortalMarkups;
    total: number;
    totalsByServiceLevel: Array<TotalByServiceLevel>;
}

export interface Vehicle {
    make: string;
    model: string;
    isOperable: boolean;  
    pricing: Pricing; 
}

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