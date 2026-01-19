export const resolveId = (value: any): any => {
  if (!value) return value;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value._id || value.value || value.id || value.portalId || value;
  }
  return value;
};
