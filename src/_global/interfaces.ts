import { Types } from "mongoose";
import { USState, ServiceLevelOption, VehicleClass } from "./enums";

export interface IGlobalModifiers {
  oversize: number;
  inoperable: number;
  discount: number;
  routes: number;
  states: number;
  vehicles: number;
}

export interface IPortalModifiers {
  commission: number;
  companyTariff: number;
  discount: number;
}

export interface IConditionalModifiers {
  enclosedFlat: number;
  enclosedPercent: number;
  serviceLevels: IModifierByServiceLevel[];
}

export interface IModifiers {
  inoperable?: number;
  routes?: number;
  states?: number;
  oversize?: number;
  vehicles?: number;
  globalDiscount?: number;
  portalDiscount?: number;
  irr?: number;
  fuel?: number;
  enclosedFlat?: number;
  enclosedPercent?: number;
  commission?: number;
  serviceLevels?: IServiceLevelModifier[];
  companyTariffs?: IServiceLevelModifier[];
  global?: IGlobalModifiers;
  portal?: IPortalModifiers;
  conditional?: IConditionalModifiers;
}

export interface IServiceLevelModifier {
  serviceLevelOption: ServiceLevelOption;
  value: number;
}

export interface IModifierByServiceLevel {
  serviceLevelOption: ServiceLevelOption;
  value: number;
}

export interface IQuoteBase {
  tms: number;
  whiteGlove: number;
  custom?: number;
}

export interface IServiceLevelPricing {
  serviceLevelOption: ServiceLevelOption;
  enclosed: number;
  open: number;
}

export interface IPricing {
  modifiers: IModifiers;
  totalModifiers?: number;
}

export interface IPricingQuote extends IPricing {
  base: IQuoteBase;
  totals: {
    whiteGlove: number;
    one: {
      open: {
        total: number;
        companyTariff: number;
        commission: number;
        totalWithCompanyTariffAndCommission: number;
      };
      enclosed: {
        total: number;
        companyTariff: number;
        commission: number;
        totalWithCompanyTariffAndCommission: number;
      };
    };
    three: {
      total: number;
      companyTariff: number;
      commission: number;
      totalWithCompanyTariffAndCommission: number;
    };
    five: {
      total: number;
      companyTariff: number;
      commission: number;
      totalWithCompanyTariffAndCommission: number;
    };
    seven: {
      total: number;
      companyTariff: number;
      commission: number;
      totalWithCompanyTariffAndCommission: number;
    };
  };
}

export interface IPricingOrder extends IPricing {
  base: number;
  total: number;
  totalTms: number;
}

export interface IVehicle {
  make: string;
  model: string;
  isInoperable: boolean;
  isOversize?: boolean;
  pricing?: IPricingQuote;
  pricingClass: VehicleClass;
  class?: string;
  vin?: string;
  year?: string;
  transportType?: string;
}

export interface IContact {
  companyName?: string;
  name?: string;
  email?: string;
  phone?: string;
  phoneMobile?: string;
  notes?: string;
}

export interface ICoordinates {
  longitude: string;
  latitude: string;
}

export interface IAddress {
  address?: string;
  addressLine2?: string;
  city?: string;
  state?: USState;
  zip?: string;
  notes?: string;
  coordinates?: ICoordinates;
}

export interface ISchedule {
  bookedAt: Date;
  serviceLevel: ServiceLevelOption;
  ontimePickup: boolean | null;
  ontimeDelivery: boolean | null;
  pickupSelected: Date;
  deliveryEstimated: [Date, Date];
  pickupCompleted: Date | null;
  deliveryCompleted: Date | null;
  notes?: string;
}

export interface IHistoryItem {
  modifiedAt: Date;
  modifiedBy?: Types.ObjectId;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}
