import mongoose, { Schema, Document, Model, Types } from "mongoose";

import { IServiceLevelModifier } from "../_global/interfaces";

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

export interface IZipModifier extends IModifier {
  zip: string;
}

export interface IVehicleModifier extends IModifier {
  makeModel: [string, string];
}

export interface IModifierSet extends Document {
  portalId?: Types.ObjectId;
  isGlobal: boolean;
  inoperable?: IModifier;
  fuel?: IModifier;
  irr?: IModifier;
  whiteGlove: {
    multiplier: number;
    minimum: number;
  };
  oversize?: {
    default: number;
    suv: number;
    van: number;
    pickup_2_doors: number;
    pickup_4_doors: number;
  };
  enclosed?: IModifier;
  discount?: IModifier;
  companyTariff?: IModifier;
  fixedCommission?: IModifier;
  routes?: Array<IRouteModifier>;
  zips?: Array<IZipModifier>;
  vehicles?: Array<IVehicleModifier>;
  serviceLevels: Array<IServiceLevelModifier>;
}

const modifierSetSchema = new Schema<IModifierSet>(
  {
    portalId: { type: Schema.Types.ObjectId, ref: "Portal" },
    isGlobal: { type: Boolean, default: false },
    inoperable: {
      value: { type: Number, default: 0 },
      valueType: { type: String, default: "flat" },
    },
    fuel: {
      value: { type: Number, default: 0 },
      valueType: { type: String, default: "flat" },
    },
    irr: {
      value: { type: Number, default: 0 },
      valueType: { type: String, default: "flat" },
    },
    whiteGlove: {
      multiplier: { type: Number, default: 2 },
      minimum: { type: Number, default: 1200 },
    },
    oversize: {
      suv: { type: Number, default: 0 },
      van: { type: Number, default: 0 },
      pickup_2_doors: { type: Number, default: 0 },
      pickup_4_doors: { type: Number, default: 0 },
    },
    enclosed: {
      value: { type: Number, default: 0 },
      valueType: { type: String, default: "flat" },
    },
    discount: {
      value: { type: Number, default: 0 },
      valueType: { type: String, default: "flat" },
    },
    companyTariff: {
      value: { type: Number, default: 0 },
      valueType: { type: String, default: "flat" },
    },
    fixedCommission: {
      value: { type: Number, default: 0 },
      valueType: { type: String, default: "flat" },
    },
    routes: [
      {
        value: { type: Number, default: 0 },
        valueType: String,
        origin: String,
        destination: String,
      },
    ],
    zips: [
      {
        value: { type: Number, default: 0 },
        valueType: String,
        zip: String,
      },
    ],
    vehicles: [
      {
        value: { type: Number, default: 0 },
        valueType: String,
        makeModel: [],
      },
    ],
    serviceLevels: Array<IServiceLevelModifier>,
  },
  { timestamps: true },
);

const ModifierSet: Model<IModifierSet> = mongoose.model<IModifierSet>(
  "ModifierSet",
  modifierSetSchema,
);
export { ModifierSet };
