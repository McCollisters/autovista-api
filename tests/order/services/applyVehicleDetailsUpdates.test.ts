import { describe, it, expect } from "@jest/globals";
import { applyVehicleDetailsToUpdateDoc } from "@/order/services/applyVehicleDetailsUpdates";

describe("applyVehicleDetailsToUpdateDoc", () => {
  it("maps vehicle identity fields onto dotted $set paths", () => {
    const updateDoc: { $set: Record<string, unknown> } = { $set: {} };

    const applied = applyVehicleDetailsToUpdateDoc(
      updateDoc,
      [
        {
          index: 0,
          vin: "1HGCM82633A004352",
          year: "2021",
          make: "Honda",
          model: "Accord",
          isInoperable: "false",
        },
      ],
      1,
    );

    expect(applied).toBe(true);
    expect(updateDoc.$set["vehicles.0.vin"]).toBe("1HGCM82633A004352");
    expect(updateDoc.$set["vehicles.0.year"]).toBe("2021");
    expect(updateDoc.$set["vehicles.0.make"]).toBe("Honda");
    expect(updateDoc.$set["vehicles.0.model"]).toBe("Accord");
    expect(updateDoc.$set["vehicles.0.isInoperable"]).toBe(false);
    expect(updateDoc.$set.vehicles).toBeUndefined();
  });

  it("ignores out-of-range indexes", () => {
    const updateDoc: { $set: Record<string, unknown> } = { $set: {} };

    expect(
      applyVehicleDetailsToUpdateDoc(
        updateDoc,
        [{ index: 4, vin: "SKIPME" }],
        1,
      ),
    ).toBe(false);
    expect(updateDoc.$set["vehicles.4.vin"]).toBeUndefined();
  });
});
