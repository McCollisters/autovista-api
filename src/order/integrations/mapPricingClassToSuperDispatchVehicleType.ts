/**
 * Maps internal vehicle / pricing class strings to Super Dispatch `vehicle.type`.
 *
 * Super Dispatch public API accepts (among others): sedan, suv, van, pickup,
 * 4_door_pickup — not `2_door_pickup` as a type value (use `pickup` for 2-door).
 *
 * Internal data uses enums, spaces, underscores, and legacy phrases; unmapped
 * values used to become `other`, which carriers often display as sedan.
 */

const normalizeForMatch = (raw: string): string =>
  raw
    .toLowerCase()
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * @param pricingClass - VehicleClass value or legacy / UI string
 * @returns Super Dispatch vehicle `type` string
 */
export function mapPricingClassToSuperDispatchVehicleType(
  pricingClass?: string | null,
): string {
  const raw = pricingClass == null ? "" : String(pricingClass).trim();
  if (!raw) {
    return "other";
  }

  const s = normalizeForMatch(raw);
  const compact = s.replace(/[^a-z0-9]/g, "");

  const exact: Record<string, string> = {
    sedan: "sedan",
    suv: "suv",
    van: "van",
    other: "other",
    pickup: "pickup",
    "pickup 2 doors": "pickup",
    "pickup 2 door": "pickup",
    "pick up 2 doors": "pickup",
    "pick up 2 door": "pickup",
    "pickup 4 doors": "4_door_pickup",
    "pickup 4 door": "4_door_pickup",
    "pick up 4 doors": "4_door_pickup",
    "pick up 4 door": "4_door_pickup",
    "4 door pickup": "4_door_pickup",
    "2 door pickup": "pickup",
  };

  if (exact[s]) {
    return exact[s];
  }

  // Compact forms (migrations / brands / typos)
  if (
    compact === "pickup4door" ||
    compact === "pickup4doors" ||
    compact === "pickupfourdoor" ||
    compact === "pickupfourdoors"
  ) {
    return "4_door_pickup";
  }
  if (
    compact === "pickup2door" ||
    compact === "pickup2doors" ||
    compact === "pickuptwodoor" ||
    compact === "pickuptwodoors"
  ) {
    return "pickup";
  }

  // Cab styles → almost always crew / quad / double (4-door class for SD)
  if (
    /(crew|quad|double|mega)[\s-]?cab/i.test(s) ||
    /super[\s-]?crew/i.test(s) ||
    /extended[\s-]?cab/i.test(s)
  ) {
    return "4_door_pickup";
  }

  const mentionsPickup =
    /\bpick[\s-]?up\b/i.test(s) ||
    /\bpickup\b/i.test(s) ||
    /\btruck\b/i.test(s) ||
    /\blight[\s-]?truck\b/i.test(s);

  if (mentionsPickup) {
    if (/\b(2|two)[\s-]door\b/i.test(s)) {
      return "pickup";
    }
    if (/\b(4|four)[\s-]door\b/i.test(s)) {
      return "4_door_pickup";
    }
    // Generic pickup / truck wording without door count → 4-door (most common; avoids SD defaulting to sedan)
    return "4_door_pickup";
  }

  return "other";
}
