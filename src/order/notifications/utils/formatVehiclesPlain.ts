/**
 * Plain-text vehicle list for email (e.g. "2020 Ford F-150, 2019 Honda Civic")
 */

import { IOrder } from "@/_global/models";

export function formatVehiclesPlain(vehicles: IOrder["vehicles"]): string {
  if (!vehicles || vehicles.length === 0) {
    return "TBD";
  }
  return vehicles
    .map((v) =>
      `${v.year || ""} ${v.make || ""} ${v.model || ""}`.replace(/\s+/g, " ").trim(),
    )
    .filter(Boolean)
    .join(", ");
}
