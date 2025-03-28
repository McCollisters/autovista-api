import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { Status, USState } from "../_global/enums"; 

export interface OrderForm {
    enableAgent: boolean;
    requireLocationType: boolean;
}

export interface QuoteForm {
    enableTariff: boolean;
    enableCommission: boolean;
}

export interface OrderPDF {
    enablePriceBreakdown: boolean;
}

export interface IOptions {
    orderForm: OrderForm;
    quoteForm: QuoteForm;
    orderPDF: OrderPDF; 
    overrideLogo: boolean; 
    enableCustomRates: boolean;
    enableVariableCompanyTariff: boolean;
    enableWhiteGloveOverride: boolean;
    enableOrderTrackingByCustomer: boolean;
    enableSurvey: boolean;
}

export interface IPortal extends Document {
    status: Status;
    companyName: string;
    companyPhone?: string;
    contactName?: string;
    contactPhone?: string;
    companyAddress?: string;
    companyCity?: string;
    companyState?: USState;
    companyZip?: string;
    companyLogo: string;
    options: IOptions;
    rules: Types.Array<Types.ObjectId>;
    parentPortalId?: Types.ObjectId | null;
}

const portalSchema = new Schema<IPortal>(
    {
      status: { type: String, enum: Object.values(Status), required: true },
      companyName: { type: String, required: true },
      companyPhone: { type: String },
      contactName: { type: String },
      contactPhone: { type: String },
      companyAddress: { type: String },
      companyCity: { type: String },
      companyState: { type: String, enum: Object.values(USState) },
      companyZip: { type: String },
      companyLogo: { type: String, required: true },
      options: {
        overrideLogo: { type: Boolean, default: false },
        enableCustomRates: { type: Boolean, default: false },
        enableVariableCompanyTariff: { type: Boolean, default: false },
        enableWhiteGloveOverride: { type: Boolean, default: false },
        enableOrderTrackingByCustomer: { type: Boolean, default: false },
        enableSurvey: { type: Boolean, default: true },
        orderForm: {
            enableAgent: { type: Boolean, default: true },
            requireLocationType: { type: Boolean, default: true },
        },
        quoteForm: {
            enableTariff:{ type: Boolean, default: true },
            enableCommission: { type: Boolean, default: true }
        },
        orderPDF: {
            enablePriceBreakdown: { type: Boolean, default: true },
        }
      },
      rules: [{ type: Schema.Types.ObjectId, ref: 'Rule' }], 
      parentPortalId: { type: Schema.Types.ObjectId, ref: 'Portal', default: null }
    },
    { timestamps: true }
  );
  
const Portal: Model<IPortal> = mongoose.model<IPortal>("Portal", portalSchema);
export { Portal };