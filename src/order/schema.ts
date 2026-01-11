import mongoose, { Document, Types } from "mongoose";
import {
  createSchema,
  createReferenceField,
  createStatusField,
  createContactSchema,
  createAddressSchema,
} from "../_global/schemas/factory";
import {
  Status,
  TransportType,
  ServiceLevelOption,
  PaymentType,
  NotificationStatus,
  VehicleClass,
} from "../_global/enums";
import {
  IPricingOrder,
  IVehicle,
  IContact,
  IAddress,
  ISchedule,
  ILocation,
  ITMS,
  IDriver,
  IAgent,
  INotification,
  INotifications,
} from "../_global/schemas/types";

// Helper function to create notification schema
const createNotificationSchema = () => ({
  status: { type: String, enum: Object.values(NotificationStatus) },
  sentAt: { type: Date },
  failedAt: { type: Date },
  recipientEmail: { type: String },
});

export interface IOrder extends Document {
  createdAt: Date;
  bookedAt: Date;
  isDirect: boolean;
  refId: number;
  reg: number;
  status: Status;
  portalId: Types.ObjectId;
  userId: Types.ObjectId;
  quoteId: Types.ObjectId;
  miles: number;
  transitTime: number[];
  transportType: TransportType;
  paymentType: PaymentType;
  hasAcceptedTerms: boolean;
  hasPaid: boolean;
  billRate: number;
  origin: ILocation & {
    longitude: string;
    latitude: string;
  };
  destination: ILocation & {
    longitude: string;
    latitude: string;
  };
  customer: IContact;
  tms: ITMS;
  vehicles: Array<
    IVehicle & {
      pricing: {
        base: number;
        modifiers: {
          inoperable: number;
          routes: number;
          states: number;
          oversize: number;
          vehicles: number;
          globalDiscount: number;
          portalDiscount: number;
          irr: number;
          fuel: number;
          enclosedFlat: number;
          enclosedPercent: number;
          commission: number;
          serviceLevels: number;
          companyTariff: number;
        };
        total: number;
        totalWithCompanyTariffAndCommission: number;
      };
    }
  >;
  totalPricing: {
    base: number;
    modifiers: {
      inoperable: number;
      routes: number;
      states: number;
      oversize: number;
      vehicles: number;
      globalDiscount: number;
      portalDiscount: number;
      irr: number;
      fuel: number;
      enclosedFlat: number;
      enclosedPercent: number;
      commission: number;
      serviceLevel: number;
      companyTariff: number;
    };
    total: number;
    totalWithCompanyTariffAndCommission: number;
  };
  schedule: ISchedule;
  hasClaim: boolean;
  driver: IDriver;
  signatureRequestSent?: boolean;
  signatureReceived?: boolean;
  signatureRequestId?: string;
  tmsPartialOrder?: boolean;
  originalOrderData?: string; // JSON stringified backup of original order before SuperDispatch updates
  acertusLoadNumber?: string; // Load number from Acertus webhook
  acertusConnectUid?: string; // Connect UID from Acertus webhook
  notifications: {
    paymentRequest: INotification;
    paymentReminder: INotification;
    signatureRequest: INotification;
    signatureRequestReminder: INotification;
    survey: INotification;
    surveyReminder: INotification;
    pickupReminder: INotification;
    agentsConfirmation: INotification;
    agentsPickupConfirmation: INotification;
    agentsDeliveryConfirmation: INotification;
    customerConfirmation: INotification;
    customerPickupConfirmation: INotification;
    customerDeliveryConfirmation: INotification;
    portalAdminPickupConfirmation: INotification;
    portalAdminDeliveryConfirmation: INotification;
  };
  agents: IAgent[];
  files?: Array<{
    name: string;
    url: string;
    key: string;
  }>;
}

const orderSchemaDefinition = {
  createdAt: { type: Date, default: Date.now },
  bookedAt: { type: Date },
  isDirect: { type: Boolean, default: false },
  refId: { type: Number, required: true },
  reg: { type: Number },
  status: createStatusField(Status, true),
  portalId: createReferenceField("Portal", true),
  userId: createReferenceField("User", true),
  quoteId: createReferenceField("Quote", true),
  miles: { type: Number },
  paymentType: { type: String },
  hasAcceptedTerms: { type: Boolean, default: false },
  hasPaid: { type: Boolean, default: false },
  billRate: { type: Number, default: null },
  transitTime: [{ type: Number }, { type: Number }],
  transportType: {
    type: String,
    enum: Object.values(TransportType),
    required: true,
  },
  origin: {
    notes: { type: String },
    locationType: { type: String },
    contact: createContactSchema(),
    address: createAddressSchema(),
    longitude: { type: String },
    latitude: { type: String },
  },
  destination: {
    notes: { type: String },
    locationType: { type: String },
    contact: createContactSchema(),
    address: createAddressSchema(),
    longitude: { type: String },
    latitude: { type: String },
  },
  customer: createContactSchema(),
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
      pricingClass: {
        type: String,
        enum: Object.values(VehicleClass),
        required: true,
        default: "sedan",
      },
      pricing: {
        base: { type: Number },
        modifiers: {
          inoperable: { type: Number, required: true, default: 0 },
          routes: { type: Number, required: true, default: 0 },
          states: { type: Number, required: true, default: 0 },
          oversize: { type: Number, required: true, default: 0 },
          vehicles: { type: Number, required: true, default: 0 },
          globalDiscount: { type: Number, required: true, default: 0 },
          portalDiscount: { type: Number, required: true, default: 0 },
          irr: { type: Number, required: true, default: 0 },
          fuel: { type: Number, required: true, default: 0 },
          enclosedFlat: { type: Number, required: true, default: 0 },
          enclosedPercent: { type: Number, required: true, default: 0 },
          commission: { type: Number, required: true, default: 0 },
          serviceLevel: { type: Number },
          companyTariff: { type: Number },
        },
        total: { type: Number },
        totalWithCompanyTariffAndCommission: { type: Number },
      },
    },
  ],
  totalPricing: {
    base: { type: Number },
    modifiers: {
      inoperable: { type: Number, required: true, default: 0 },
      routes: { type: Number, required: true, default: 0 },
      states: { type: Number, required: true, default: 0 },
      oversize: { type: Number, required: true, default: 0 },
      vehicles: { type: Number, required: true, default: 0 },
      globalDiscount: { type: Number, required: true, default: 0 },
      portalDiscount: { type: Number, required: true, default: 0 },
      irr: { type: Number, required: true, default: 0 },
      fuel: { type: Number, required: true, default: 0 },
      enclosedFlat: { type: Number, required: true, default: 0 },
      enclosedPercent: { type: Number, required: true, default: 0 },
      commission: { type: Number, required: true, default: 0 },
      serviceLevel: { type: Number },
      companyTariff: { type: Number },
    },
    total: { type: Number, required: true },
    totalWithCompanyTariffAndCommission: {
      type: Number,
      required: true,
      default: 0,
    },
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
    pickupEstimated: [{ type: Date }],
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
  files: [
    {
      name: { type: String, required: true },
      url: { type: String, required: true },
      key: { type: String, required: true },
    },
  ],
  hasClaim: { type: Boolean, default: false },
  signatureRequestSent: { type: Boolean, default: false },
  signatureReceived: { type: Boolean, default: false },
  signatureRequestId: { type: String },
  tmsPartialOrder: { type: Boolean, default: false },
  originalOrderData: { type: String }, // JSON stringified backup of original order before SuperDispatch updates
  acertusLoadNumber: { type: String }, // Load number from Acertus webhook
  acertusConnectUid: { type: String }, // Connect UID from Acertus webhook
  notifications: {
    paymentRequest: createNotificationSchema(),
    paymentReminder: createNotificationSchema(),
    signatureRequest: createNotificationSchema(),
    signatureRequestReminder: createNotificationSchema(),
    survey: createNotificationSchema(),
    surveyReminder: createNotificationSchema(),
    pickupReminder: createNotificationSchema(),
    agentsConfirmation: createNotificationSchema(),
    agentsPickupConfirmation: createNotificationSchema(),
    agentsDeliveryConfirmation: createNotificationSchema(),
    customerConfirmation: createNotificationSchema(),
    customerPickupConfirmation: createNotificationSchema(),
    customerDeliveryConfirmation: createNotificationSchema(),
    portalAdminPickupConfirmation: createNotificationSchema(),
    portalAdminDeliveryConfirmation: createNotificationSchema(),
  },
};

const orderSchema = createSchema<IOrder>(orderSchemaDefinition);

// Model is exported from model.ts file
export { orderSchema };
