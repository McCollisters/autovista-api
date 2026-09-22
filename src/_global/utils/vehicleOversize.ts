/**
 * Model names that always receive the oversize surcharge (global/portals default rate).
 */
export const isPre1975ClassicModel = (model: unknown): boolean => {
  if (model == null || model === "") {
    return false;
  }

  const normalized = String(model).toLowerCase().replace(/\s+/g, " ").trim();

  return (
    normalized.includes("1975") &&
    normalized.includes("classic") &&
    (normalized.includes("other-pre") ||
      normalized.includes("other pre") ||
      normalized.includes("other - pre"))
  );
};

export const shouldAutoSetVehicleOversize = (params: {
  model?: unknown;
  pricingClass?: unknown;
}): boolean => {
  if (isPre1975ClassicModel(params.model)) {
    return true;
  }

  const pricingClass = String(params.pricingClass ?? "")
    .toLowerCase()
    .trim();

  return (
    pricingClass === "suv" ||
    pricingClass === "van" ||
    pricingClass === "pickup_2_doors" ||
    pricingClass === "pickup_4_doors" ||
    pricingClass.includes("pickup")
  );
};
