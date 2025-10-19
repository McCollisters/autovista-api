import mongoose, { Document, Types } from "mongoose";
import {
  createSchema,
  createReferenceField,
  createStatusField,
  createContactSchema,
  createAddressSchema,
} from "../_global/schemas/factory";
import { Status, USState } from "../_global/enums";
import {
  IContact,
  IAddress,
  IOrderForm,
  IQuoteForm,
  IOrderPDF,
  IOptions,
} from "../_global/schemas/types";

// Define ICustomRate interface locally since it's only used in portal context
export interface ICustomRate {
  value: number;
  label: string;
  min: number;
  max: number;
}

export interface IPortal extends Document {
  status: string;
  companyName: string;
  contact?: IContact;
  address?: IAddress;
  logo?: string;
  options: IOptions;
  customRates: Array<ICustomRate>;
  parentPortalId: Types.ObjectId | null;
}

const portalSchema = createSchema<IPortal>({
  status: createStatusField(Status, true),
  companyName: { type: String, required: true },
  contact: createContactSchema(),
  address: createAddressSchema(),
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
    customRates: [
      {
        label: { type: String },
        min: { type: Number },
        max: { type: Number },
        value: { type: Number },
      },
    ],
    parentPortalId: { type: String, default: null },
  },
  customRates: [
    {
      label: { type: String },
      min: { type: Number },
      max: { type: Number },
      value: { type: Number },
    },
  ],
  parentPortalId: createReferenceField("Portal", false),
});

// Model is exported from model.ts file
export { portalSchema };
