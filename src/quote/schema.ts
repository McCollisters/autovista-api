import mongoose, { Schema, Document, Model, Types } from "mongoose";
import mongooseSequence from "mongoose-sequence";

import {
  Status,
  USState,
  TransportType,
  ServiceLevelOption,
  VehicleClass,
} from "../_global/enums";
import { IPricingQuote, IVehicle, IHistoryItem } from "../_global/interfaces";

const AutoIncrement = (mongooseSequence as any)(mongoose);

export interface ICustomer extends Document {
  name?: string;
  email?: string;
  phone?: string;
  trackingCode?: string;
}

export interface IQuote extends Document {
  refId?: number;
  status: Status;
  portalId: Types.ObjectId;
  userId: Types.ObjectId;
  origin: {
    userInput: string;
    validated: string;
    state?: USState;
    longitude?: string;
    latitude?: string;
  };
  destination: {
    userInput: string;
    validated: string;
    state?: USState;
    longitude?: string;
    latitude?: string;
  };
  miles?: number;
  transportType?: TransportType;
  transitTime?: [number, number];
  vehicles: Array<IVehicle>;
  totalPricing: IPricingQuote;
  archivedAt?: Date;
  customer?: ICustomer;
  history: Array<IHistoryItem>;
}

const generateTrackingCode = (): string => {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
};

const quoteSchema = new Schema<IQuote>(
  {
    refId: { type: Number },
    status: { type: String, enum: Object.values(Status), required: true },
    portalId: { type: Schema.Types.ObjectId, ref: "Portal", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    customer: {
      name: { type: String },
      email: { type: String },
      phone: { type: String },
      trackingCode: { type: String },
    },
    origin: {
      userInput: { type: String },
      validated: { type: String },
      state: { type: String },
      coordinates: {
        long: { type: String },
        lat: { type: String },
      },
    },
    destination: {
      userInput: { type: String },
      validated: { type: String },
      state: { type: String },
      coordinates: {
        long: { type: String },
        lat: { type: String },
      },
    },
    miles: { type: Number },
    transitTime: [{ type: Number }, { type: Number }],
    vehicles: [
      {
        _id: false,
        make: { type: String, required: true },
        model: { type: String, required: true },
        isInoperable: { type: Boolean, required: true, default: false },
        pricingClass: {
          type: String,
          enum: Object.values(VehicleClass),
          required: true,
          default: "sedan",
        },
        pricing: {
          base: {
            tms: { type: Number },
            whiteGlove: { type: Number },
            custom: { type: Number },
          },
          modifiers: {
            global: {
              inoperable: { type: Number, required: true, default: 0 },
              routes: { type: Number, required: true, default: 0 },
              oversize: { type: Number, required: true, default: 0 },
              vehicles: { type: Number, required: true, default: 0 },
            },
            portal: {
              commission: { type: Number, required: true, default: 0 },
              companyTariff: { type: Number, required: true, default: 0 },
              discount: { type: Number, required: true, default: 0 },
              irr: { type: Number, required: true, default: 0 },
              fuel: { type: Number, required: true, default: 0 },
            },
            conditional: {
              enclosedFlat: { type: Number, required: true, default: 0 },
              enclosedPercent: { type: Number, required: true, default: 0 },
              enclosedExtraCompanyTariff: {
                type: Number,
                required: true,
                default: 0,
              },
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
            },
          },
          // totals include base price + modifiers
          total: {
            whiteGlove: {
              enclosed: { type: Number },
              enclosedTms: { type: Number },
            },
            withoutServiceLevel: {
              open: { type: Number },
              openTms: { type: Number },
              enclosed: { type: Number },
              enclosedTms: { type: Number },
            },
          },
        },
      },
    ],
    totalPricing: {
      base: {
        tms: { type: Number },
        whiteGlove: { type: Number },
        custom: { type: Number },
      },
      modifiers: {
        global: {
          inoperable: { type: Number, required: true, default: 0 },
          oversize: { type: Number, required: true, default: 0 },
          routes: { type: Number, required: true, default: 0 },
          vehicles: { type: Number, required: true, default: 0 },
        },
        portal: {
          commission: { type: Number, required: true, default: 0 },
          discount: { type: Number, required: true, default: 0 },
          companyTariff: { type: Number, required: true, default: 0 },
        },
        conditional: {
          enclosedFlat: { type: Number, required: true, default: 0 },
          enclosedPercent: { type: Number, required: true, default: 0 },
          enclosedExtraCompanyTariff: {
            type: Number,
            required: true,
            default: 0,
          },
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
        },
      },
      total: {
        whiteGlove: {
          enclosed: { type: Number },
          enclosedTms: { type: Number },
        },
        // base + modifiers
        withoutServiceLevel: {
          // base + globalMod + portalMod
          open: { type: Number },
          // base + globalMod,
          openTms: { type: Number },
          // base + globalMod + portalMod + enclosedConditional,
          enclosed: { type: Number },
          // base + globalMod + enclosedConditional,
          enclosedTms: { type: Number },
        },
      },
    },
    archivedAt: { type: Date },
    history: [
      {
        modifiedAt: { type: Date, default: Date.now },
        modifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
        changes: {
          field: { type: String },
          oldValue: { type: Schema.Types.Mixed },
          newValue: { type: Schema.Types.Mixed },
        },
      },
    ],
  },
  { timestamps: true },
);

quoteSchema.virtual("vehicleCount").get(function (this: IQuote) {
  return this.vehicles.length;
});

quoteSchema.set("toJSON", {
  virtuals: true,
});

quoteSchema.set("toObject", {
  virtuals: true,
});

quoteSchema.pre<IQuote>("save", function (next) {
  if (this.customer && !this.customer.trackingCode) {
    this.customer.trackingCode = generateTrackingCode();
  }
  next();
});

quoteSchema.pre<IQuote>("save", function (next) {
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
        modifiedBy: this.userId,
        changes,
      });
    }
  }
  next();
});

quoteSchema.index({ "$**": "text" });

quoteSchema.plugin(AutoIncrement, { inc_field: "refId", start_seq: 101000 });

const Quote: Model<IQuote> = mongoose.model<IQuote>("Quote", quoteSchema);
export { Quote };
