export type VehicleDetailsInput = {
  index?: number;
  vin?: string | null;
  year?: string | null;
  make?: string | null;
  model?: string | null;
  isInoperable?: boolean | string | number | null;
};

const normalizeString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  return String(value).trim();
};

const normalizeBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "no") return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return undefined;
};

export const applyVehicleDetailsToUpdateDoc = (
  updateDoc: Record<string, any>,
  inputs?: VehicleDetailsInput[] | null,
  vehicleCount = 0,
): boolean => {
  if (!Array.isArray(inputs) || inputs.length === 0 || vehicleCount < 1) {
    return false;
  }
  if (!updateDoc.$set || typeof updateDoc.$set !== "object") {
    updateDoc.$set = {};
  }

  let applied = false;

  inputs.forEach((input) => {
    const index = Number(input?.index);
    if (!Number.isInteger(index) || index < 0 || index >= vehicleCount) {
      return;
    }

    const vin = normalizeString(input.vin);
    const year = normalizeString(input.year);
    const make = normalizeString(input.make);
    const model = normalizeString(input.model);
    const isInoperable = normalizeBoolean(input.isInoperable);

    if (vin !== undefined) {
      updateDoc.$set[`vehicles.${index}.vin`] = vin;
      applied = true;
    }
    if (year !== undefined) {
      updateDoc.$set[`vehicles.${index}.year`] = year;
      applied = true;
    }
    if (make !== undefined) {
      updateDoc.$set[`vehicles.${index}.make`] = make;
      applied = true;
    }
    if (model !== undefined) {
      updateDoc.$set[`vehicles.${index}.model`] = model;
      applied = true;
    }
    if (isInoperable !== undefined) {
      updateDoc.$set[`vehicles.${index}.isInoperable`] = isInoperable;
      applied = true;
    }
  });

  return applied;
};
