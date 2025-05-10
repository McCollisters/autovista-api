import mongoose, { Schema, Document, Model, Types } from "mongoose";

export enum ModifierSetType {
  Markup = "markup",
  Discount = "discount",
  LocationModifier = "location_modifier",
  Minimum = "minimum",
  Override = "override",
}

export enum ValueType {
  Percentage = "percentage",
  Flat = "flat",
}

export interface IModifier extends Document {
  value: number;
  valueType: string;
}

export interface IRouteModifier extends IModifier {
  origin: string;
  destination: string;
}

export interface IModifierSet extends Document {
  portalId?: Types.ObjectId;
  isGlobal: boolean;
  inoperable?: IModifier;
  fuel?: IModifier;
  irr?: IModifier;
  oversize?: {
    default: number;
    suv: number;
    van: number;
    pickup_2_door: number;
    pickup_4_door: number;
  };
  enclosed?: IModifier;
  discount?: IModifier;
  companyTariff?: IModifier;
  fixedCommission?: IModifier;
  routes?: Array<IRouteModifier>;
}

const modifierSetSchema = new Schema<IModifierSet>(
  {
    portalId: { type: Schema.Types.ObjectId, ref: "Portal" },
    isGlobal: { type: Boolean, default: false },
    inoperable: {
      value: Number,
      valueType: { type: String, default: "flat" },
    },
    fuel: {
      value: Number,
      valueType: { type: String, default: "flat" },
    },
    irr: {
      value: Number,
      valueType: { type: String, default: "flat" },
    },
    oversize: {
      default: Number,
      suv: Number,
      van: Number,
      pickup_2_door: Number,
      pickup_4_door: Number,
    },
    enclosed: {
      value: Number,
      valueType: { type: String, default: "flat" },
    },
    discount: {
      value: Number,
      valueType: { type: String, default: "flat" },
    },
    companyTariff: {
      value: Number,
      valueType: { type: String, default: "flat" },
    },
    fixedCommission: {
      value: Number,
      valueType: { type: String, default: "flat" },
    },
    routes: [
      {
        value: Number,
        valueType: String,
        origin: String,
        destination: String,
      },
    ],
  },
  { timestamps: true },
);

const ModifierSet: Model<IModifierSet> = mongoose.model<IModifierSet>(
  "ModifierSet",
  modifierSetSchema,
);
export { ModifierSet };
