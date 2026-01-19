import mongoose, { Document, Types } from "mongoose";
import { createSchema, createReferenceField } from "../_global/schemas/factory";
import { IServiceLevelModifier } from "../_global/schemas/types";

export enum ModifierSetType {
  Markup = "markup",
  Discount = "discount",
  LocationModifier = "location_modifier",
  Minimum = "minimum",
  Override = "override",
}

export enum Direction {
  Inbound = "inbound",
  Outbound = "outbound",
  Both = "both",
}

export enum ValueType {
  Percentage = "percentage",
  Flat = "flat",
}

export interface IModifier extends Document {
  value: number;
  valueType: ValueType;
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
  portal?: Types.ObjectId;
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
  companyTariffDiscount?: IModifier; // set by portal admins, the discount is subtracted from the company tariff
  companyTariffEnclosedFee?: IModifier; // for variable company tariffs, this is the additional fee for enclosed transport, it is added to the company tariff
  portalWideCommission?: IModifier;
  states?: Map<
    string,
    {
      direction: Direction;
      value: number;
      valueType: ValueType;
    }
  >;
  routes?: Array<IRouteModifier>;
  zips?: Array<IZipModifier>;
  vehicles?: Array<IVehicleModifier>;
  serviceLevels: Array<IServiceLevelModifier>;
}

const modifierSetSchemaDefinition = {
  portal: createReferenceField("Portal", false),
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
    valueType: { type: String, default: "flat" },
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
  companyTariffDiscount: {
    value: { type: Number, default: 0 },
    valueType: { type: String, default: "flat" },
  },
  // companyTariff + companyTariffEnclosedFee = the enclosed company tariff
  companyTariffEnclosedFee: {
    value: { type: Number, default: 0 },
    valueType: { type: String, default: "flat" },
  },
  portalWideCommission: {
    value: { type: Number, default: 0 },
    valueType: { type: String, default: "flat" },
  },
  states: {
    type: Map,
    of: {
      direction: { type: String, enum: Object.values(Direction) },
      value: { type: Number, required: true },
      valueType: {
        type: String,
        enum: Object.values(ValueType),
        required: true,
      },
    },
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
  serviceLevels: [
    {
      serviceLevelOption: { type: String, required: true },
      value: { type: Number, required: true },
    },
  ],
};

const modifierSetSchema = createSchema<IModifierSet>(
  modifierSetSchemaDefinition,
);

// Ensure only one global modifier set exists
modifierSetSchema.index(
  { isGlobal: 1 },
  { unique: true, partialFilterExpression: { isGlobal: true } },
);

// Model is exported from model.ts file
export { modifierSetSchema };
