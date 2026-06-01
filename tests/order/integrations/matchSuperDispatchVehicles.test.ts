import { describe, it, expect } from "@jest/globals";
import {
  matchSuperDispatchVehicles,
  collectUnmatchedSdVehicles,
} from "@/order/integrations/matchSuperDispatchVehicles";

describe("matchSuperDispatchVehicles", () => {
  it("matches two same make/model vehicles to distinct SD vehicles (no duplicate guid)", () => {
    const sdVehicles = [
      { guid: "sd-1", make: "Toyota", model: "Camry" },
      { guid: "sd-2", make: "Toyota", model: "Camry" },
    ];
    const localVehicles = [
      { make: "Toyota", model: "Camry" },
      { make: "Toyota", model: "Camry" },
    ];

    const matched = matchSuperDispatchVehicles(sdVehicles, localVehicles);

    expect(matched).toHaveLength(2);
    expect(matched[0]?.guid).toBe("sd-1");
    expect(matched[1]?.guid).toBe("sd-2");
    expect(matched[0]?.guid).not.toBe(matched[1]?.guid);
  });

  it("prefers VIN match over positional order", () => {
    const sdVehicles = [
      { guid: "sd-1", vin: "AAA", make: "Toyota", model: "Camry" },
      { guid: "sd-2", vin: "BBB", make: "Honda", model: "Accord" },
    ];
    const localVehicles = [
      { vin: "BBB", make: "Honda", model: "Accord" },
      { vin: "AAA", make: "Toyota", model: "Camry" },
    ];

    const matched = matchSuperDispatchVehicles(sdVehicles, localVehicles);

    expect(matched[0]?.guid).toBe("sd-2");
    expect(matched[1]?.guid).toBe("sd-1");
  });

  it("falls back to make/model when VINs are absent (partial orders)", () => {
    const sdVehicles = [
      { guid: "sd-1", make: "Toyota", model: "Camry" },
      { guid: "sd-2", make: "Honda", model: "Accord" },
    ];
    const localVehicles = [
      { make: "Honda", model: "Accord", vin: "BBB" },
      { make: "Toyota", model: "Camry", vin: "AAA" },
    ];

    const matched = matchSuperDispatchVehicles(sdVehicles, localVehicles);

    expect(matched[0]?.guid).toBe("sd-2");
    expect(matched[1]?.guid).toBe("sd-1");
  });

  it("never assigns the same SD vehicle to more than one local vehicle", () => {
    const sdVehicles = [
      { guid: "sd-1", make: "Toyota", model: "Camry" },
      { guid: "sd-2", make: "Ford", model: "F-150" },
      { guid: "sd-3", make: "Toyota", model: "Camry" },
    ];
    const localVehicles = [
      { make: "Toyota", model: "Camry" },
      { make: "Toyota", model: "Camry" },
      { make: "Ford", model: "F-150" },
    ];

    const matched = matchSuperDispatchVehicles(sdVehicles, localVehicles);

    const assignedGuids = matched.map((m) => m?.guid);
    expect(new Set(assignedGuids).size).toBe(assignedGuids.length);
    expect(assignedGuids).toContain("sd-1");
    expect(assignedGuids).toContain("sd-2");
    expect(assignedGuids).toContain("sd-3");
  });

  it("returns null for a local vehicle that has no available SD match", () => {
    const sdVehicles = [{ guid: "sd-1", make: "Toyota", model: "Camry" }];
    const localVehicles = [
      { make: "Toyota", model: "Camry" },
      { make: "Honda", model: "Accord" },
    ];

    const matched = matchSuperDispatchVehicles(sdVehicles, localVehicles);

    expect(matched[0]?.guid).toBe("sd-1");
    expect(matched[1]).toBeNull();
  });

  it("uses positional fallback when make/model differ but counts match", () => {
    const sdVehicles = [
      { guid: "sd-1", make: "Old Make A", model: "Old Model A" },
      { guid: "sd-2", make: "Old Make B", model: "Old Model B" },
    ];
    const localVehicles = [
      { make: "New Make A", model: "New Model A" },
      { make: "New Make B", model: "New Model B" },
    ];

    const matched = matchSuperDispatchVehicles(sdVehicles, localVehicles);

    expect(matched[0]?.guid).toBe("sd-1");
    expect(matched[1]?.guid).toBe("sd-2");
  });
});

describe("collectUnmatchedSdVehicles", () => {
  it("returns SD vehicles not matched to any local vehicle (different make/models)", () => {
    const sdVehicles = [
      { guid: "sd-1", make: "Toyota", model: "Camry" },
      { guid: "sd-2", make: "Honda", model: "Accord" },
    ];
    // Local order somehow only has one vehicle.
    const localVehicles = [{ make: "Toyota", model: "Camry" }];

    const matched = matchSuperDispatchVehicles(sdVehicles, localVehicles);
    const unmatched = collectUnmatchedSdVehicles(sdVehicles, matched);

    expect(matched[0]?.guid).toBe("sd-1");
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].guid).toBe("sd-2");
  });

  it("returns empty when every SD vehicle is matched", () => {
    const sdVehicles = [
      { guid: "sd-1", make: "Toyota", model: "Camry" },
      { guid: "sd-2", make: "Honda", model: "Accord" },
    ];
    const localVehicles = [
      { make: "Toyota", model: "Camry" },
      { make: "Honda", model: "Accord" },
    ];

    const matched = matchSuperDispatchVehicles(sdVehicles, localVehicles);
    const unmatched = collectUnmatchedSdVehicles(sdVehicles, matched);

    expect(unmatched).toHaveLength(0);
  });

  it("preserved + matched together never drop an SD vehicle", () => {
    const sdVehicles = [
      { guid: "sd-1", make: "Toyota", model: "Camry" },
      { guid: "sd-2", make: "Honda", model: "Accord" },
      { guid: "sd-3", make: "Ford", model: "F-150" },
    ];
    const localVehicles = [{ make: "Honda", model: "Accord" }];

    const matched = matchSuperDispatchVehicles(sdVehicles, localVehicles);
    const unmatched = collectUnmatchedSdVehicles(sdVehicles, matched);

    const finalGuids = [
      ...matched.filter(Boolean).map((m) => m!.guid),
      ...unmatched.map((u) => u.guid),
    ].sort();

    expect(finalGuids).toEqual(["sd-1", "sd-2", "sd-3"]);
  });
});
