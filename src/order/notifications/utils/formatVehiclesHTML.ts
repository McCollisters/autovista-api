/**
 * Format Vehicles HTML
 *
 * Formats vehicle information as HTML for email templates
 */

import { IOrder } from "@/_global/models";

export function formatVehiclesHTML(
  vehicles: IOrder["vehicles"],
  includePricing: boolean = false,
): string {
  if (!vehicles || vehicles.length === 0) {
    return "<p>No vehicles listed.</p>";
  }

  let html = "<ul>";

  vehicles.forEach((vehicle) => {
    html += "<li>";
    html += `<strong>${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}</strong>`;

    if (vehicle.vin) {
      html += `<br />VIN: ${vehicle.vin}`;
    }

    if (vehicle.isInoperable) {
      html += "<br /><em>Inoperable</em>";
    }

    if (includePricing && vehicle.pricing?.total) {
      html += `<br />Price: $${vehicle.pricing.total.toFixed(2)}`;
    }

    html += "</li>";
  });

  html += "</ul>";

  return html;
}
