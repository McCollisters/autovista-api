import { mapPricingClassToSuperDispatchVehicleType } from "@/order/integrations/mapPricingClassToSuperDispatchVehicleType";

describe("mapPricingClassToSuperDispatchVehicleType", () => {
  it("maps enum-style values", () => {
    expect(mapPricingClassToSuperDispatchVehicleType("pickup_4_doors")).toBe(
      "4_door_pickup",
    );
    expect(mapPricingClassToSuperDispatchVehicleType("pickup_2_doors")).toBe(
      "pickup",
    );
    expect(mapPricingClassToSuperDispatchVehicleType("sedan")).toBe("sedan");
    expect(mapPricingClassToSuperDispatchVehicleType("suv")).toBe("suv");
    expect(mapPricingClassToSuperDispatchVehicleType("van")).toBe("van");
    expect(mapPricingClassToSuperDispatchVehicleType("pickup")).toBe("pickup");
  });

  it("maps spaced / UI phrases from pricing", () => {
    expect(mapPricingClassToSuperDispatchVehicleType("pick up 4 doors")).toBe(
      "4_door_pickup",
    );
    expect(mapPricingClassToSuperDispatchVehicleType("pick up 2 doors")).toBe(
      "pickup",
    );
    expect(mapPricingClassToSuperDispatchVehicleType("Pickup 4 door")).toBe(
      "4_door_pickup",
    );
  });

  it("maps compact migration-style strings", () => {
    expect(mapPricingClassToSuperDispatchVehicleType("pickup4door")).toBe(
      "4_door_pickup",
    );
    expect(mapPricingClassToSuperDispatchVehicleType("pickup2door")).toBe(
      "pickup",
    );
  });

  it("maps cab styles to 4_door_pickup", () => {
    expect(mapPricingClassToSuperDispatchVehicleType("crew cab")).toBe(
      "4_door_pickup",
    );
    expect(mapPricingClassToSuperDispatchVehicleType("quad-cab")).toBe(
      "4_door_pickup",
    );
  });

  it("maps generic truck wording without door count to 4_door_pickup", () => {
    expect(mapPricingClassToSuperDispatchVehicleType("pickup truck")).toBe(
      "4_door_pickup",
    );
    expect(mapPricingClassToSuperDispatchVehicleType("light truck")).toBe(
      "4_door_pickup",
    );
  });

  it("returns other for empty", () => {
    expect(mapPricingClassToSuperDispatchVehicleType("")).toBe("other");
    expect(mapPricingClassToSuperDispatchVehicleType(null)).toBe("other");
  });
});
