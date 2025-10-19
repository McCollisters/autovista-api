/**
 * Schema Factory Utilities
 *
 * This file provides utilities for creating consistent Mongoose schemas
 * with standardized options and middleware.
 */

import mongoose, { Schema, SchemaDefinition } from "mongoose";

/**
 * Creates a schema with standard options
 */
export function createSchema<T>(definition: any, options: any = {}): any {
  const schema = new Schema(definition, {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        // Remove sensitive fields from JSON output
        const { __v, ...cleanRet } = ret;
        return cleanRet;
      },
    },
    toObject: {
      virtuals: true,
    },
    ...options,
  });

  // Add text search index
  schema.index({ "$**": "text" });

  return schema;
}

/**
 * Creates a reference field with proper typing
 */
export function createReferenceField(ref: string, required = true) {
  return {
    type: Schema.Types.ObjectId,
    ref,
    required,
  };
}

/**
 * Creates a status field with enum validation
 */
export function createStatusField(
  enumValues: Record<string, string>,
  required = true,
) {
  return {
    type: String,
    enum: Object.values(enumValues),
    required,
    default: Object.values(enumValues)[0],
  };
}

/**
 * Creates a coordinates subdocument
 */
export function createCoordinatesSchema() {
  return {
    longitude: { type: String },
    latitude: { type: String },
  };
}

/**
 * Creates a contact subdocument
 */
export function createContactSchema() {
  return {
    companyName: { type: String },
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    phoneMobile: { type: String },
    notes: { type: String },
  };
}

/**
 * Creates an address subdocument
 */
export function createAddressSchema() {
  return {
    address: { type: String },
    addressLine2: { type: String },
    city: { type: String },
    state: { type: String },
    zip: { type: String },
    notes: { type: String },
    coordinates: createCoordinatesSchema(),
  };
}

/**
 * Creates a location subdocument
 */
export function createLocationSchema() {
  return {
    locationType: { type: String },
    contact: createContactSchema(),
    address: createAddressSchema(),
    notes: { type: String },
  };
}
