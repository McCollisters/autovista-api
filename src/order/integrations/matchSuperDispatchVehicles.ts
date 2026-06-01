/**
 * Match local order vehicles to existing Super Dispatch vehicles.
 *
 * Local vehicles do not store a Super Dispatch vehicle identifier, so matching
 * is done by VIN, then make/model, then positional index. Critically, each
 * Super Dispatch vehicle is consumed at most once: this guarantees the
 * resulting PATCH never contains two entries that carry the same SD vehicle
 * `guid`. Super Dispatch keys vehicles by `guid` in a merge-patch, so duplicate
 * guids would collapse multiple vehicles into one (effectively deleting the
 * extra vehicles).
 */

type LocalVehicleLike = {
  vin?: string | null;
  make?: string | null;
  model?: string | null;
};

const normalize = (value?: string | number | null): string =>
  value == null ? "" : String(value).toLowerCase().trim();

const makeModelKey = (make?: string | null, model?: string | null): string =>
  `${normalize(make)}::${normalize(model)}`;

/**
 * Returns an array aligned to `localVehicles`. Each entry is the matched Super
 * Dispatch vehicle object, or `null` when no unused SD vehicle could be matched
 * (in which case callers should omit the SD `guid` so SD treats it as a new,
 * distinct vehicle rather than a duplicate of an existing one).
 */
export const matchSuperDispatchVehicles = <T extends Record<string, any>>(
  sdVehicles: T[],
  localVehicles: ReadonlyArray<LocalVehicleLike>,
): Array<T | null> => {
  const used = new Array<boolean>(sdVehicles.length).fill(false);
  const matches: Array<T | null> = new Array<T | null>(
    localVehicles.length,
  ).fill(null);

  const claim = (
    predicate: (sdVehicle: T, sdIndex: number) => boolean,
  ): T | null => {
    for (let i = 0; i < sdVehicles.length; i += 1) {
      if (!used[i] && predicate(sdVehicles[i], i)) {
        used[i] = true;
        return sdVehicles[i];
      }
    }
    return null;
  };

  // Pass 1: VIN (strongest identity).
  localVehicles.forEach((vehicle, localIndex) => {
    const vin = normalize(vehicle.vin);
    if (!vin) return;
    const matched = claim((sd) => normalize(sd.vin) === vin);
    if (matched) {
      matches[localIndex] = matched;
    }
  });

  // Pass 2: make/model, consuming from the pool so two vehicles that share a
  // make/model can never resolve to the same SD vehicle.
  localVehicles.forEach((vehicle, localIndex) => {
    if (matches[localIndex]) return;
    const key = makeModelKey(vehicle.make, vehicle.model);
    const matched = claim((sd) => makeModelKey(sd.make, sd.model) === key);
    if (matched) {
      matches[localIndex] = matched;
    }
  });

  // Pass 3: positional fallback to the SD vehicle at the same index, if unused.
  localVehicles.forEach((_vehicle, localIndex) => {
    if (matches[localIndex]) return;
    if (localIndex < sdVehicles.length && !used[localIndex]) {
      used[localIndex] = true;
      matches[localIndex] = sdVehicles[localIndex];
    }
  });

  // Pass 4: assign any remaining unused SD vehicle in order.
  localVehicles.forEach((_vehicle, localIndex) => {
    if (matches[localIndex]) return;
    const matched = claim(() => true);
    if (matched) {
      matches[localIndex] = matched;
    }
  });

  return matches;
};

/**
 * Returns the Super Dispatch vehicles that were NOT matched to any local
 * vehicle (by reference identity against the result of
 * {@link matchSuperDispatchVehicles}).
 *
 * Super Dispatch PATCH uses RFC 7396 JSON Merge Patch, where arrays are
 * replaced wholesale: any SD vehicle missing from the PATCH `vehicles` array is
 * deleted. Callers should append these preserved vehicles to the PATCH body so
 * a shorter local vehicle list can never silently delete SD vehicles.
 */
export const collectUnmatchedSdVehicles = <T extends Record<string, any>>(
  sdVehicles: T[],
  matches: ReadonlyArray<T | null>,
): T[] => {
  const matched = new Set<T>(matches.filter((m): m is T => m != null));
  return sdVehicles.filter((sdVehicle) => !matched.has(sdVehicle));
};
