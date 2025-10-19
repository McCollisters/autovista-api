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

export interface IOrder extends Document {
  createdAt: Date;
  bookedAt: Date;
  isDirect: boolean;
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

const orderSchemaDefinition = {
  createdAt: { type: Date, default: Date.now },
  bookedAt: { type: Date },
  isDirect: { type: Boolean, default: false },
  refId: { type: String, required: true },
  reg: { type: String },
  status: createStatusField(Status, true),
  portalId: createReferenceField("Portal", true),
  userId: createReferenceField("User", true),
  quoteId: createReferenceField("Quote", true),
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
    contact: createContactSchema(),
    address: createAddressSchema(),
  },
  destination: {
    notes: { type: String },
    locationType: { type: String },
    contact: createContactSchema(),
    address: createAddressSchema(),
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
          serviceLevels: [
            {
              _id: false,
              serviceLevelOption: {
                type: String,
                enum: Object.values(ServiceLevelOption),
              },
              value: { type: Number },
            },
          ],
          companyTariffs: [
            {
              _id: false,
              serviceLevelOption: {
                type: String,
                enum: Object.values(ServiceLevelOption),
              },
              value: { type: Number },
            },
          ],
        },
        totals: {
          whiteGlove: { type: Number, required: true, default: 0 },
          one: {
            open: {
              total: { type: Number, required: true, default: 0 },
              companyTariff: { type: Number, required: true, default: 0 },
              commission: { type: Number, required: true, default: 0 },
              totalWithCompanyTariffAndCommission: {
                type: Number,
                required: true,
                default: 0,
              },
            },
            enclosed: {
              total: { type: Number, required: true, default: 0 },
              companyTariff: { type: Number, required: true, default: 0 },
              commission: { type: Number, required: true, default: 0 },
              totalWithCompanyTariffAndCommission: {
                type: Number,
                required: true,
                default: 0,
              },
            },
          },
          three: {
            total: { type: Number, required: true, default: 0 },
            companyTariff: { type: Number, required: true, default: 0 },
            commission: { type: Number, required: true, default: 0 },
            totalWithCompanyTariffAndCommission: {
              type: Number,
              required: true,
              default: 0,
            },
          },
          five: {
            total: { type: Number, required: true, default: 0 },
            companyTariff: { type: Number, required: true, default: 0 },
            commission: { type: Number, required: true, default: 0 },
            totalWithCompanyTariffAndCommission: {
              type: Number,
              required: true,
              default: 0,
            },
          },
          seven: {
            total: { type: Number, required: true, default: 0 },
            companyTariff: { type: Number, required: true, default: 0 },
            commission: { type: Number, required: true, default: 0 },
            totalWithCompanyTariffAndCommission: {
              type: Number,
              required: true,
              default: 0,
            },
          },
        },
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
      serviceLevels: [
        {
          _id: false,
          serviceLevelOption: {
            type: String,
            enum: Object.values(ServiceLevelOption),
          },
          value: { type: Number },
        },
      ],
      companyTariffs: [
        {
          _id: false,
          serviceLevelOption: {
            type: String,
            enum: Object.values(ServiceLevelOption),
          },
          value: { type: Number },
        },
      ],
    },
    totals: {
      whiteGlove: { type: Number, required: true, default: 0 },
      one: {
        open: {
          total: { type: Number, required: true, default: 0 },
          companyTariff: { type: Number, required: true, default: 0 },
          commission: { type: Number, required: true, default: 0 },
          totalWithCompanyTariffAndCommission: {
            type: Number,
            required: true,
            default: 0,
          },
        },
        enclosed: {
          total: { type: Number, required: true, default: 0 },
          companyTariff: { type: Number, required: true, default: 0 },
          commission: { type: Number, required: true, default: 0 },
          totalWithCompanyTariffAndCommission: {
            type: Number,
            required: true,
            default: 0,
          },
        },
      },
      three: {
        total: { type: Number, required: true, default: 0 },
        companyTariff: { type: Number, required: true, default: 0 },
        commission: { type: Number, required: true, default: 0 },
        totalWithCompanyTariffAndCommission: {
          type: Number,
          required: true,
          default: 0,
        },
      },
      five: {
        total: { type: Number, required: true, default: 0 },
        companyTariff: { type: Number, required: true, default: 0 },
        commission: { type: Number, required: true, default: 0 },
        totalWithCompanyTariffAndCommission: {
          type: Number,
          required: true,
          default: 0,
        },
      },
      seven: {
        total: { type: Number, required: true, default: 0 },
        companyTariff: { type: Number, required: true, default: 0 },
        commission: { type: Number, required: true, default: 0 },
        totalWithCompanyTariffAndCommission: {
          type: Number,
          required: true,
          default: 0,
        },
      },
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
};

const orderSchema = createSchema<IOrder>(orderSchemaDefinition);

// Model is exported from model.ts file
export { orderSchema };
