import {
  isPre1975ClassicModel,
  shouldAutoSetVehicleOversize,
} from "@/_global/utils/vehicleOversize";

describe("vehicleOversize", () => {
  describe("isPre1975ClassicModel", () => {
    it("matches Other-pre 1975 classic model name", () => {
      expect(isPre1975ClassicModel("Other-pre 1975 classic")).toBe(true);
      expect(isPre1975ClassicModel("other pre 1975 classic")).toBe(true);
      expect(isPre1975ClassicModel("Other - pre 1975 classic")).toBe(true);
    });

    it("does not match unrelated models", () => {
      expect(isPre1975ClassicModel("Camry")).toBe(false);
      expect(isPre1975ClassicModel("Other")).toBe(false);
    });
  });

  describe("shouldAutoSetVehicleOversize", () => {
    it("returns true for pre-1975 classic regardless of class", () => {
      expect(
        shouldAutoSetVehicleOversize({
          model: "Other-pre 1975 classic",
          pricingClass: "sedan",
        }),
      ).toBe(true);
    });

    it("returns true for suv", () => {
      expect(
        shouldAutoSetVehicleOversize({ model: "X5", pricingClass: "suv" }),
      ).toBe(true);
    });
  });
});
