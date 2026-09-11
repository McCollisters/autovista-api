import { normalizeUsZip } from "@/_global/utils/normalizeUsZip";

export type LocationAddressInput = {
  address?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export type LocationContactInput = {
  companyName?: string | null;
  name?: string | null;
};

type AddressFallback = {
  address?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
};

const normalizeString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  return String(value).trim();
};

export const applyLocationAddressToUpdateDoc = (
  updateDoc: Record<string, any>,
  prefix: "origin" | "destination",
  input?: LocationAddressInput | null,
): boolean => {
  if (!input || typeof input !== "object") {
    return false;
  }
  if (!updateDoc.$set || typeof updateDoc.$set !== "object") {
    updateDoc.$set = {};
  }

  const address = normalizeString(input.address);
  const addressLine2 = normalizeString(input.addressLine2);
  const city = normalizeString(input.city);
  const state = normalizeString(input.state);
  const zip = normalizeString(input.zip);

  if (
    address === undefined &&
    addressLine2 === undefined &&
    city === undefined &&
    state === undefined &&
    zip === undefined
  ) {
    return false;
  }

  if (address !== undefined) {
    updateDoc.$set[`${prefix}.address.address`] = address;
  }
  if (addressLine2 !== undefined) {
    updateDoc.$set[`${prefix}.address.addressLine2`] = addressLine2;
  }
  if (city !== undefined) {
    updateDoc.$set[`${prefix}.address.city`] = city;
  }
  if (state !== undefined) {
    updateDoc.$set[`${prefix}.address.state`] = state;
  }
  if (zip !== undefined) {
    updateDoc.$set[`${prefix}.address.zip`] = zip ? normalizeUsZip(zip) : zip;
  }

  return true;
};

export const applyLocationContactToUpdateDoc = (
  updateDoc: Record<string, any>,
  prefix: "origin" | "destination",
  input?: LocationContactInput | null,
): boolean => {
  if (!input || typeof input !== "object") {
    return false;
  }
  if (!updateDoc.$set || typeof updateDoc.$set !== "object") {
    updateDoc.$set = {};
  }

  const companyName = normalizeString(input.companyName);
  const name = normalizeString(input.name);

  if (companyName === undefined && name === undefined) {
    return false;
  }

  if (companyName !== undefined) {
    updateDoc.$set[`${prefix}.contact.companyName`] = companyName;
  }
  if (name !== undefined) {
    updateDoc.$set[`${prefix}.contact.name`] = name;
  }

  return true;
};

export const applyLocationNotesToUpdateDoc = (
  updateDoc: Record<string, any>,
  prefix: "origin" | "destination",
  notes?: string | null,
): boolean => {
  if (notes === undefined) {
    return false;
  }
  if (!updateDoc.$set || typeof updateDoc.$set !== "object") {
    updateDoc.$set = {};
  }

  updateDoc.$set[`${prefix}.notes`] = normalizeString(notes) ?? "";
  return true;
};

export const formatLocationAddressForGeocode = (
  input: LocationAddressInput,
  fallback?: AddressFallback,
): string => {
  const parts = [
    input.address ?? fallback?.address,
    input.addressLine2 ?? fallback?.addressLine2,
    input.city ?? fallback?.city,
    input.state ?? fallback?.state,
    input.zip ?? fallback?.zip,
  ]
    .map((part) => (part == null ? "" : String(part).trim()))
    .filter(Boolean);

  return parts.join(", ");
};
