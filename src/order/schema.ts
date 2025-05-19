import mongoose, { Schema, Document, Model, Types } from "mongoose";
import {
  Status,
  TransportType,
  USState,
  ServiceLevelOption,
} from "../_global/enums";
import {
  IPricing,
  IVehicle,
  IContact,
  IAddress,
  ISchedule,
} from "../_global/interfaces";

export interface Location {
  contact: IContact;
  address: IAddress;
}

export interface TMS {
  guid: string;
  status: string;
  updatedAt: Date;
  createdAt: Date;
}

export interface IOrder extends Document {
  refId: string;
  reg: string;
  status: Status;
  portalId: Types.ObjectId;
  userId: Types.ObjectId;
  quoteId: Types.ObjectId;
  miles: number;
  transportType: TransportType;
  origin: Location;
  destination: Location;
  customer: IContact;
  tms: TMS;
  vehicles: Array<IVehicle>;
  totalPricing: IPricing;
  schedule: ISchedule;
}

const orderSchema = new Schema<IOrder>(
  {
    refId: { type: String, required: true },
    reg: { type: String },
    status: { type: String, enum: Object.values(Status), required: true },
    portalId: { type: Schema.Types.ObjectId, ref: "Portal", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    quoteId: { type: Schema.Types.ObjectId, ref: "Quote", required: true },
    miles: { type: Number },
    transportType: {
      type: String,
      enum: Object.values(TransportType),
      required: true,
    },
    origin: {
      contact: {
        companyName: { type: String },
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
        notes: { type: String },
        longitude: { type: String },
        latitude: { type: String },
      },
    },
    destination: {
      contact: {
        companyName: { type: String },
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
        notes: { type: String },
        longitude: { type: String },
        latitude: { type: String },
      },
    },
    customer: {
      companyName: { type: String },
      name: { type: String },
      email: { type: String },
      phone: { type: String },
      phoneMobile: { type: String },
      notes: { type: String },
    },
    tms: {
      guid: { type: String },
      status: { type: String },
      updatedAt: { type: Date },
      createdAt: { type: Date },
    },
    vehicles: [
      {
        make: { type: String, required: true },
        model: { type: String, required: true },
        year: { type: String },
        vin: { type: String },
        class: { type: String },
        isInoperable: { type: Boolean, required: true, default: false },
        pricing: {
          base: { type: Number, required: true, default: 0 },
          globalMarkups: {
            inoperable: { type: Number, required: true, default: 0 },
            oversize: { type: Number, required: true, default: 0 },
          },
          portalMarkups: {
            commission: { type: Number, required: true, default: 0 },
            companyTariff: { type: Number, required: true, default: 0 },
          },
        },
      },
    ],
    totalPricing: {
      base: { type: Number, required: true },
      globalMarkups: {
        total: { type: Number, required: true, default: 0 },
        inoperable: { type: Number, required: true, default: 0 },
        oversize: { type: Number, required: true, default: 0 },
        serviceLevels: [
          {
            serviceLevelOption: {
              type: String,
              enum: Object.values(ServiceLevelOption),
            },
            value: { type: Number, required: true },
          },
        ],
      },
      portalMarkups: {
        total: { type: Number, required: true, default: 0 },
        commission: { type: Number, required: true, default: 0 },
        companyTariff: { type: Number, required: true, default: 0 },
      },
      totalsByServiceLevel: [
        {
          serviceLevelOption: {
            type: String,
            enum: Object.values(ServiceLevelOption),
          },
          total: { type: Number, required: true },
        },
      ],
      total: { type: Number, required: true },
    },
    schedule: {
      serviceLevel: {
        type: String,
        enum: Object.values(ServiceLevelOption),
        required: true,
      },
      pickupSelected: { type: Date, required: true },
      deliveryEstimated: { type: Date, required: true },
      pickupCompleted: { type: Date },
      deliveryCompleted: { type: Date },
      notes: { type: String },
    },
  },
  { timestamps: true },
);

const Order: Model<IOrder> = mongoose.model<IOrder>("Order", orderSchema);
export { Order };
