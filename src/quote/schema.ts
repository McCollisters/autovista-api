/**
 * Improved Quote Schema
 *
 * This is a refactored version of the quote schema using the new structure.
 * It demonstrates best practices for schema organization.
 */

import mongoose, { Schema, Types } from "mongoose";
import mongooseSequence from "mongoose-sequence";
import {
  createSchema,
  createReferenceField,
  createStatusField,
} from "../_global/schemas/factory";
import {
  Status,
  USState,
  TransportType,
  ServiceLevelOption,
  VehicleClass,
} from "../_global/enums";
// Import interfaces for type checking only
import type { IQuote, IQuoteCustomer, IQuoteLocation } from "./interfaces";

const AutoIncrement = (mongooseSequence as any)(mongoose);

// Generate tracking code utility
const generateTrackingCode = (): string => {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
};

// Customer subdocument schema
const customerSchema = new Schema<IQuoteCustomer>(
  {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    trackingCode: { type: String },
  },
  { _id: false },
);

// Location subdocument schema
const locationSchema = new Schema<IQuoteLocation>(
  {
    userInput: { type: String },
    validated: { type: String },
    state: { type: String, enum: Object.values(USState) },
    coordinates: {
      long: { type: String },
      lat: { type: String },
    },
  },
  { _id: false },
);

// Vehicle subdocument schema
const vehicleSchema = new Schema(
  {
    _id: false,
    make: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: String },
    isInoperable: { type: Boolean, required: true, default: false },
    isOversize: { type: Boolean, default: false },
    transportType: { type: String },
    pricingClass: {
      type: String,
      enum: Object.values(VehicleClass),
      required: true,
      default: VehicleClass.Sedan,
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
          // Legacy fallback
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
          // Legacy fallback
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
          // Legacy fallback
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
  { _id: false },
);

// History item subdocument schema
const historyItemSchema = new Schema(
  {
    modifiedAt: { type: Date, default: Date.now },
    modifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    changes: [
      {
        field: { type: String },
        oldValue: { type: Schema.Types.Mixed },
        newValue: { type: Schema.Types.Mixed },
      },
    ],
  },
  { _id: false },
);

// Main quote schema definition
const quoteSchemaDefinition = {
  refId: { type: Number },
  isDirect: { type: Boolean, default: false },
  status: createStatusField(Status, true),
  portal: createReferenceField("Portal", true),
  user: createReferenceField("User", false),
  customer: customerSchema,
  origin: locationSchema,
  destination: locationSchema,
  miles: { type: Number },
  transportType: {
    type: String,
    enum: Object.values(TransportType),
  },
  transitTime: [{ type: Number }, { type: Number }],
  vehicles: [vehicleSchema],
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
          // Legacy fallback
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
          // Legacy fallback
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
          // Legacy fallback
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
  archivedAt: { type: Date, default: null },
  history: [historyItemSchema],
};

// Create the schema using the factory
const quoteSchema = createSchema<IQuote>(quoteSchemaDefinition);

// Add virtuals
quoteSchema.virtual("vehicleCount").get(function (this: IQuote) {
  return this.vehicles.length;
});
quoteSchema.virtual("portalId").get(function (this: IQuote) {
  return (this as any).portal;
});
quoteSchema.virtual("userId").get(function (this: IQuote) {
  return (this as any).user;
});

// Add pre-save middleware
quoteSchema.pre("save", function (this: IQuote, next: () => void) {
  // Ensure portal is an ObjectId
  if ((this as any).portal && typeof (this as any).portal === "string") {
    if (Types.ObjectId.isValid((this as any).portal)) {
      (this as any).portal = new Types.ObjectId((this as any).portal) as any;
    }
  }

  // Ensure user is an ObjectId
  if ((this as any).user && typeof (this as any).user === "string") {
    if (Types.ObjectId.isValid((this as any).user)) {
      (this as any).user = new Types.ObjectId((this as any).user) as any;
    }
  }

  if (this.customer && !this.customer.trackingCode) {
    this.customer.trackingCode = generateTrackingCode();
  }
  next();
});

quoteSchema.pre("save", function (this: IQuote, next: () => void) {
  if (this.isModified()) {
    const changes: { field: string; oldValue: any; newValue: any }[] = [];
    this.modifiedPaths().forEach((path) => {
      const oldValue = this.get(path, null, {
        getters: false,
        virtuals: false,
      });
      const newValue = this.get(path);

      if (oldValue !== newValue) {
        changes.push({ field: path, oldValue, newValue });
      }
    });
    if (changes.length > 0) {
      this.history.push({
        modifiedAt: new Date(),
        modifiedBy: (this as any).user,
        changes,
      });
    }
  }
  next();
});

// Add auto-increment plugin
// Explicitly set the counter ID to ensure consistency
quoteSchema.plugin(AutoIncrement, { 
  inc_field: "refId", 
  start_seq: 300000,
  id: "Quote_refId" // Explicitly set counter ID to avoid conflicts
});

export { quoteSchema };
export type { IQuote, IQuoteCustomer, IQuoteLocation } from "./interfaces";
