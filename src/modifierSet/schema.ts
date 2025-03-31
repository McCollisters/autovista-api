import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { Status, USState } from "../_global/enums"; 

export enum ModifierSetType {
    Markup = "markup",
    Discount = "discount",
    LocationModifier = "location_modifier",
    Minimum = "minimum",
    Override = "override"
}

export enum ValueType {
    Percentage = "percentage",
    Fixed = "fixed",
}

export interface IModifier extends Document {
    value: Number,
    valueType: String,
    modifierType: String 
}

export interface IRouteModifier extends IModifier {
    origin: string;
    destination: string;
  }

export interface IModifierSet extends Document {
    portalId: Types.ObjectId;
    isGlobal: Boolean,
    inoperable?: IModifier, 
    oversize?: IModifier,
    routes?: Array<IRouteModifier>
    companyTariff?: IModifier
}

const modifierSetSchema = new Schema<IModifierSet>(
    {
        portalId: { type: Schema.Types.ObjectId, ref: 'Portal' },
        isGlobal: { type: Boolean, default: false },
        inoperable: {
            value: Number, 
            valueType: { type: String, default: "flat"},
            modifierType: { type: String, default: "markup"}
        }, 
        oversize: {
            value: Number, 
            valueType: { type: String, default: "flat"},
            modifierType: { type: String, default: "markup"}
        }, 
        routes: [{  
            value: Number,
            valueType: String,
            modifierType: String,
            origin: String,
            destination: String 
        }]

        


        
    },
    { timestamps: true }
);
  
const ModifierSet: Model<IModifierSet> = mongoose.model<IModifierSet>("ModifierSet", modifierSetSchema);
export { ModifierSet };