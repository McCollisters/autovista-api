/**
 * Centralized Type Definitions for Mongoose Schemas
 *
 * This file contains all interface definitions used across schemas.
 * It provides a single source of truth for type definitions.
 */

import { Document, Types } from "mongoose";
import {
  Status,
  USState,
  TransportType,
  ServiceLevelOption,
  VehicleClass,
  PaymentType,
  NotificationStatus,
} from "../enums";

// ============================================================================
// CORE INTERFACES
// ============================================================================

export interface IContact {
  companyName?: string;
  name?: string;
  email?: string;
  phone?: string;
  phoneMobile?: string;
  notes?: string;
  termsAccepted?: boolean;
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

export interface ILocation {
  locationType?: string;
  contact?: IContact;
  address?: IAddress;
  notes?: string;
}

// ============================================================================
// VEHICLE INTERFACES
// ============================================================================

export interface IVehicle {
  make: string;
  model: string;
  year?: string;
  vin?: string;
  class?: string;
  isInoperable: boolean;
  pricingClass: VehicleClass;
  pricing?: IPricingQuote;
}

// ============================================================================
// PRICING INTERFACES
// ============================================================================

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

// ============================================================================
// SCHEDULE & NOTIFICATION INTERFACES
// ============================================================================

export interface ISchedule {
  serviceLevel: ServiceLevelOption;
  ontimePickup?: boolean | null;
  ontimeDelivery?: boolean | null;
  pickupSelected: Date;
  pickupEstimated: Date[];
  deliveryEstimated: Date[];
  pickupCompleted?: Date | null;
  deliveryCompleted?: Date | null;
  notes?: string;
}

export interface INotification {
  status: NotificationStatus;
  sentAt?: Date;
  failedAt?: Date;
  recipientEmail?: string;
}

export interface INotifications {
  survey?: INotification;
  surveyReminder?: INotification;
  pickupReminder?: INotification;
  agentsPickupConfirmation?: INotification;
  agentsDeliveryConfirmation?: INotification;
  customerPickupConfirmation?: INotification;
  customerDeliveryConfirmation?: INotification;
  portalAdminPickupConfirmation?: INotification;
  portalAdminDeliveryConfirmation?: INotification;
}

// ============================================================================
// HISTORY & TRACKING INTERFACES
// ============================================================================

export interface IHistoryItem {
  modifiedAt: Date;
  modifiedBy?: Types.ObjectId;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

// ============================================================================
// CUSTOMER INTERFACES
// ============================================================================

export interface ICustomer {
  name?: string;
  email?: string;
  phone?: string;
  trackingCode?: string;
}

// ============================================================================
// TMS INTERFACES
// ============================================================================

export interface ITMS {
  guid?: string;
  status?: string;
  updatedAt?: Date;
  createdAt?: Date;
}

export interface IDriver {
  captivatedId?: string;
  latitude?: string;
  longitude?: string;
  phone?: string;
  updatedAt?: Date;
}

export interface IAgent {
  name: string;
  email: string;
  enablePickupNotifications?: boolean;
  enableDeliveryNotifications?: boolean;
}

// ============================================================================
// PORTAL INTERFACES
// ============================================================================

export interface IOrderForm {
  enableAgent: boolean;
  requireLocationType: boolean;
}

export interface IQuoteForm {
  enableTariff: boolean;
  enableCommission: boolean;
}

export interface IOrderPDF {
  enablePriceBreakdown: boolean;
}

export interface IOptions {
  orderForm: IOrderForm;
  quoteForm: IQuoteForm;
  orderPDF: IOrderPDF;
  overrideLogo: boolean;
  enableCustomRates: boolean;
  enableVariableCompanyTariff: boolean;
  enableWhiteGloveOverride: boolean;
  enableOrderTrackingByCustomer: boolean;
  enableSurvey: boolean;
  customRates: Array<{
    value: number;
    label: string;
    min: number;
    max: number;
  }>;
  parentPortalId: string | null;
}

// ============================================================================
// ORDER INTERFACES
// ============================================================================

export interface ITMS {
  guid?: string;
  status?: string;
  updatedAt?: Date;
  createdAt?: Date;
}

export interface IDriver {
  captivatedId?: string;
  latitude?: string;
  longitude?: string;
  phone?: string;
  updatedAt?: Date;
}
