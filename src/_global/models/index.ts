/**
 * Centralized Model Registry
 *
 * This file provides a single source of truth for all Mongoose models.
 * It ensures consistent model creation and prevents duplicate model registration.
 */

import mongoose, { Model } from "mongoose";

// Import all schemas
import { quoteSchema } from "../../quote/schema";
import { IQuote } from "../../quote/interfaces";
import { orderSchema, IOrder } from "../../order/schema";
import { userSchema, IUser } from "../../user/schema";
import { portalSchema, IPortal } from "../../portal/schema";
import { modifierSetSchema, IModifierSet } from "../../modifierSet/schema";
import { brandSchema, IBrand } from "../../brand/schema";
import { surveySchema, ISurvey } from "../../survey/schema";
import {
  surveyResponseSchema,
  ISurveyResponse,
} from "../../surveyResponse/schema";
import { carrierSchema, ICarrier } from "../../carrier/schema";
import { settingsSchema, ISettings } from "../../settings/schema";
import { emailTemplateSchema, IEmailTemplate } from "../../email/schema";

// Model registry interface
interface ModelRegistry {
  Quote: Model<IQuote>;
  Order: Model<IOrder>;
  User: Model<IUser>;
  Portal: Model<IPortal>;
  ModifierSet: Model<IModifierSet>;
  Brand: Model<IBrand>; // Also known as "Make" in legacy API
  Survey: Model<ISurvey>;
  SurveyResponse: Model<ISurveyResponse>;
  Carrier: Model<ICarrier>;
  Settings: Model<ISettings>;
  EmailTemplate: Model<IEmailTemplate>;
}

// Create models with consistent pattern
const createModel = <T>(name: string, schema: any): Model<T> => {
  // Check if model already exists to prevent re-registration
  if (mongoose.models[name]) {
    return mongoose.models[name] as Model<T>;
  }
  return mongoose.model<T>(name, schema);
};

// Export all models
export const models: ModelRegistry = {
  Quote: createModel<IQuote>("Quote", quoteSchema),
  Order: createModel<IOrder>("Order", orderSchema),
  User: createModel<IUser>("User", userSchema),
  Portal: createModel<IPortal>("Portal", portalSchema),
  ModifierSet: createModel<IModifierSet>("ModifierSet", modifierSetSchema),
  Brand: createModel<IBrand>("Brand", brandSchema),
  Survey: createModel<ISurvey>("Survey", surveySchema),
  SurveyResponse: createModel<ISurveyResponse>(
    "SurveyResponse",
    surveyResponseSchema,
  ),
  Carrier: createModel<ICarrier>("Carrier", carrierSchema),
  Settings: createModel<ISettings>("Settings", settingsSchema),
  EmailTemplate: createModel<IEmailTemplate>("EmailTemplate", emailTemplateSchema),
};

// Individual model exports for convenience
export const {
  Quote,
  Order,
  User,
  Portal,
  ModifierSet,
  Brand,
  Survey,
  SurveyResponse,
  Carrier,
  Settings,
  EmailTemplate,
} = models;

// Export types for convenience
export type { IQuote } from "../../quote/interfaces";
export type { IOrder } from "../../order/schema";
export type { IUser } from "../../user/schema";
export type { IPortal } from "../../portal/schema";
export type { IModifierSet } from "../../modifierSet/schema";
export type { IBrand } from "../../brand/schema";
export type { ISurvey } from "../../survey/schema";
export type { ISurveyResponse } from "../../surveyResponse/schema";
export type { ICarrier } from "../../carrier/schema";
export type { ISettings } from "../../settings/schema";
export type { IEmailTemplate } from "../../email/schema";
