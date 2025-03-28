import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { Status, USState, TransportType, ServiceLevelOption } from "../_global/enums"; 

// Need to think through how to organize service levels, totals, vehicle breakdown, etc.

export interface Vehicle {
    make: string;
    model: string;
    isOperable: boolean;  
    pricing: Pricing; 
}

export interface ServiceLevelMarkups {
    serviceLevelOption: ServiceLevelOption;
    value: number; 
}

export interface GlobalMarkups {
    inoperable: number;
    oversize: number;
    serviceLevels: ServiceLevelMarkups;
}

export interface PortalMarkups {
    commission: number;
    companyTariff: number;
}0

export interface TotalWithServiceLevels {
    serviceLevelOption: ServiceLevelOption;
    total: number;
}

export interface Pricing {
    totalWithoutServiceLevels: number;
    totalWithServiceLevels: Array<TotalWithServiceLevels>;
    base: number;
    globalMarkups: GlobalMarkups;
    portalMarkups: PortalMarkups;
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

  quoteSchema.virtual("pricingTotals").get(function () {
    const totalBase = this.vehicles.reduce((total, v) => total + v.pricing.base, 0);
    const totalCommission = this.vehicles.reduce((total, v) => total + v.pricing.portalMarkups.commission, 0);
    const totalCompanyTariff = this.vehicles.reduce((total, v) => total + v.pricing.portalMarkups.companyTariff, 0);

    return {
        totalBase, 
        totalCommission,
        totalCompanyTariff
    }
}); 

  
quoteSchema.set("toJSON", {
    virtuals: true,
});
  
const Quote: Model<IQuote> = mongoose.model<IQuote>("Quote", quoteSchema);
export { Quote };