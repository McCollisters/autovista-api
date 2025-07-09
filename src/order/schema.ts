import mongoose, { Schema, Document, Model, Types } from "mongoose";
import {
  Status,
  TransportType,
  USState,
  ServiceLevelOption,
  PaymentType,
  NotificationStatus,
} from "../_global/enums";

import {
  IPricingOrder,
  IVehicle,
  IContact,
  IAddress,
  ISchedule,
} from "../_global/interfaces";

export interface ILocation {
  locationType: string;
  contact: IContact;
  address: IAddress;
}

export interface ITMS {
  guid: string;
  status: string;
  updatedAt: Date;
  createdAt: Date;
}

export interface IDriver {
  captivatedId: string;
  latitude: string;
  longitude: string;
  phone: string;
  updatedAt: Date;
}

export interface IAgent {
  name: string;
  email: string;
  enablePickupNotificiations: boolean;
  enableDeliveryNotifications: boolean;
}

export interface INotification {
  status: NotificationStatus;
  sentAt: Date;
  failedAt: Date;
}

export interface INotifications {
  survey: INotification;
  pickupReminder: INotification;
  agentsPickupConfirmation: INotification;
  agentsDeliveryConfirmation: INotification;
  customerPickupConfirmation: INotification;
  customerDeliveryConfirmation: INotification;
  portalAdminPickupConfirmation: INotification;
  portalAdminDeliveryConfirmation: INotification;
}

export interface IOrder extends Document {
  createdAt: Date;
  bookedAt: Date;
  refId: string;
  reg: string;
  status: Status;
  portalId: Types.ObjectId;
  userId: Types.ObjectId;
  quoteId: Types.ObjectId;
  miles: number;
  transportType: TransportType;
  paymentType: PaymentType;
  origin: ILocation;
  destination: ILocation;
  customer: IContact;
  tms: ITMS;
  vehicles: Array<IVehicle>;
  totalPricing: IPricingOrder;
  schedule: ISchedule;
  hasClaim: boolean;
  driver: IDriver;
  notifications: INotifications;
  agents: IAgent[];
}

const orderSchema = new Schema<IOrder>(
  {
    createdAt: { type: Date, default: Date.now },
    bookedAt: { type: Date },
    refId: { type: String, required: true },
    reg: { type: String },
    status: { type: String, enum: Object.values(Status), required: true },
    portalId: { type: Schema.Types.ObjectId, ref: "Portal", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    quoteId: { type: Schema.Types.ObjectId, ref: "Quote", required: true },
    miles: { type: Number },
    paymentType: { type: String },
    transportType: {
      type: String,
      enum: Object.values(TransportType),
      required: true,
    },
    origin: {
      notes: { type: String },
      locationType: { type: String },
      contact: {
        companyName: { type: String },
        name: { type: String },
        email: { type: String },
        phone: { type: String },
        phoneMobile: { type: String },
      },
      address: {
        address: { type: String },
        addressLine2: { type: String },
        city: { type: String },
        state: { type: String, enum: Object.values(USState) },
        zip: { type: String },
        longitude: { type: String },
        latitude: { type: String },
      },
    },
    destination: {
      notes: { type: String },
      locationType: { type: String },
      contact: {
        companyName: { type: String },
        name: { type: String },
        email: { type: String },
        phone: { type: String },
        phoneMobile: { type: String },
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
      termsAccepted: { type: Boolean, default: false },
    },
    tms: {
      guid: { type: String },
      status: { type: String },
      updatedAt: { type: Date },
      createdAt: { type: Date },
    },
    vehicles: [
      {
        _id: false,
        make: { type: String, required: true },
        model: { type: String, required: true },
        year: { type: String },
        vin: { type: String },
        class: { type: String },
        isInoperable: { type: Boolean, required: true, default: false },
        pricing: {
          base: { type: Number, required: true, default: 0 },
          modifiers: {
            global: {
              inoperable: { type: Number, required: true, default: 0 },
              discount: { type: Number, required: true, default: 0 },
              routes: { type: Number, required: true, default: 0 },
              oversize: { type: Number, required: true, default: 0 },
              vehicles: { type: Number, required: true, default: 0 },
            },
            conditional: {
              enclosedFlat: { type: Number, required: true, default: 0 },
              enclosedPercent: { type: Number, required: true, default: 0 },
              enclosedExtraCompanyTariff: {
                type: Number,
                required: true,
                default: 0,
              },
              serviceLevelSelected: { type: Number, required: true, default: 0 },
            },
            portal: {
              commission: { type: Number, required: true, default: 0 },
              companyTariff: { type: Number, required: true, default: 0 },
              discount: { type: Number, required: true, default: 0 },
              irr: { type: Number, required: true, default: 0 },
              fuel: { type: Number, required: true, default: 0 },
            },
          },
          totalModifiers: { type: Number, required: true },
          totalTms: { type: Number, required: true }, // total - (companyTariff + commision)
          total: { type: Number, required: true },
        },
      },
    ],
    totalPricing: {
      base: { type: Number, required: true, default: 0 },
      modifiers: {
        global: {
          inoperable: { type: Number, required: true, default: 0 },
          discount: { type: Number, required: true, default: 0 },
          routes: { type: Number, required: true, default: 0 },
          oversize: { type: Number, required: true, default: 0 },
          vehicles: { type: Number, required: true, default: 0 },
        },
        conditional: {
          enclosedFlat: { type: Number, required: true, default: 0 },
          enclosedPercent: { type: Number, required: true, default: 0 },
          enclosedExtraCompanyTariff: {
            type: Number,
            required: true,
            default: 0,
          },
          serviceLevel: { type: Number, required: true, default: 0 },
        },
        portal: {
          commission: { type: Number, required: true, default: 0 },
          companyTariff: { type: Number, required: true, default: 0 },
          discount: { type: Number, required: true, default: 0 },
          irr: { type: Number, required: true, default: 0 },
          fuel: { type: Number, required: true, default: 0 },
        },
      },
      totalModifiers: { type: Number, required: true }, // modifiers incl conditional
      total: { type: Number, required: true }, // base + modifiers
      totalTms: { type: Number, required: true }, // total - (companyTariff + commision)
    },
    schedule: {
      serviceLevel: {
        type: String,
        enum: Object.values(ServiceLevelOption),
        required: true,
      },
      ontimePickup: { type: Boolean, default: null },
      ontimeDelivery: { type: Boolean, default: null },
      pickupSelected: { type: Date, required: true },
      deliveryEstimated: [{ type: Date }],
      pickupCompleted: { type: Date, default: null },
      deliveryCompleted: { type: Date, default: null },
      notes: { type: String },
    },
    driver: {
      captivatedId: { type: String },
      latitude: { type: String },
      longitude: { type: String },
      phone: { type: String },
      updatedAt: { type: Date, default: null },
    },
    agents: [
      {
        name: { type: String },
        email: { type: String },
        enablePickupNotifications: { type: Boolean, default: true },
        enableDeliveryNotifications: { type: Boolean, default: true },
      },
    ],
    hasClaim: { type: Boolean, default: false },
    notifications: {
      survey: { 
        status: { type: String, enum: Object.values(NotificationStatus) },
        sentAt: { type: Date },
        failedAt: { type: Date },
       },
      surveyReminder: { 
        status: { type: String, enum: Object.values(NotificationStatus) },
        sentAt: { type: Date },
        failedAt: { type: Date },
       },
       pickupReminder: { 
        status: { type: String, enum: Object.values(NotificationStatus) },
        sentAt: { type: Date },
        failedAt: { type: Date },
       },
       agentsPickupConfirmation: { 
        status: { type: String, enum: Object.values(NotificationStatus) },
        sentAt: { type: Date },
        failedAt: { type: Date },
       },
       agentsDeliveryConfirmation: { 
        status: { type: String, enum: Object.values(NotificationStatus) },
        sentAt: { type: Date }, 
        failedAt: { type: Date },
       },
       customerPickupConfirmation: { 
        status: { type: String, enum: Object.values(NotificationStatus) },
        sentAt: { type: Date },
        failedAt: { type: Date },
       },       
       customerDeliveryConfirmation: { 
        status: { type: String, enum: Object.values(NotificationStatus) },
        sentAt: { type: Date },
        failedAt: { type: Date },
       },
       portalAdminPickupConfirmation: { 
        status: { type: String, enum: Object.values(NotificationStatus) },
        sentAt: { type: Date },
        failedAt: { type: Date },
       },
       portalAdminDeliveryConfirmation: { 
        status: { type: String, enum: Object.values(NotificationStatus) },  
        sentAt: { type: Date },
        failedAt: { type: Date },
       },
    },
  },
  { timestamps: true },
);

const Order: Model<IOrder> = mongoose.model<IOrder>("Order", orderSchema);
export { Order };