import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { IContact, IAddress } from "../_global/interfaces";
import { Status, USState } from "../_global/enums";

export interface IOrderForm {
  enableAgent: boolean;
  requireLocationType: boolean;
}

export interface IQuoteForm {
  enableTariff: boolean;
  enableCommission: boolean;
}

export interface IOrderPDF {
  enablePriceBreakdown: boolean;
}

export interface IOptions {
  orderForm: IOrderForm;
  quoteForm: IQuoteForm;
  orderPDF: IOrderPDF;
  overrideLogo: boolean;
  enableCustomRates: boolean;
  enableVariableCompanyTariff: boolean;
  enableWhiteGloveOverride: boolean;
  enableOrderTrackingByCustomer: boolean;
  enableSurvey: boolean;
}

export interface ICustomRate {
  value: number;
  label: string;
  min: number;
  max: number;
}

export interface IPortal extends Document {
  status: string;
  companyName: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    phoneMobile?: string;
    notes?: string;
  };
  address?: {
    address?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  logo?: string;
  options: {
    overrideLogo: boolean;
    enableCustomRates: boolean;
    enableVariableCompanyTariff: boolean;
    enableWhiteGloveOverride: boolean;
    enableOrderTrackingByCustomer: boolean;
    enableSurvey: boolean;
    orderForm: {
      enableAgent: boolean;
      requireLocationType: boolean;
    };
    quoteForm: {
      enableTariff: boolean;
      enableCommission: boolean;
    };
    orderPDF: {
      enablePriceBreakdown: boolean;
    };
    customRates: Array<ICustomRate>;
    parentPortalId: string | null;
  };
  customRates: Array<ICustomRate>;
  customWhiteGloveRates: Array<ICustomRate>;
  parentPortalId: string | null;
  isWhiteGloveOnly: boolean;
}

const portalSchema = new Schema<IPortal>(
  {
    status: { type: String, enum: Object.values(Status), required: true },
    companyName: { type: String, required: true },
    contact: {
      name: { type: String },
      email: { type: String },
      phone: { type: String },
      phoneMobile: { type: String },
      notes: { type: String },
    },
    address: {
      address: { type: String },
      addressLine2: { type: String },
      city: { type: String },
      state: { type: String, enum: Object.values(USState) },
      zip: { type: String },
    },
    logo: { type: String },
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
        enableTariff: { type: Boolean, default: true },
        enableCommission: { type: Boolean, default: true },
      },
      orderPDF: {
        enablePriceBreakdown: { type: Boolean, default: true },
      },
    },
    customRates: [
      {
        label: { type: String },
        min: { type: Number },
        max: { type: Number },
        value: { type: Number },
      },
    ],
    customWhiteGloveRates: [
      {
        label: { type: String },
        min: { type: Number },
        max: { type: Number },
        value: { type: Number },
      },
    ],
    parentPortalId: {
      type: Schema.Types.ObjectId,
      ref: "Portal",
      default: null,
    },
    isWhiteGloveOnly: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const Portal: Model<IPortal> = mongoose.model<IPortal>("Portal", portalSchema);
export { Portal };
