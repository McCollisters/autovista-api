import { describe, it, expect } from "@jest/globals";
import { isWithheldAddress } from "@/order/utils/checkWithheldAddress";

describe("isWithheldAddress", () => {
  it("returns false for blank values", () => {
    expect(isWithheldAddress(undefined)).toBe(false);
    expect(isWithheldAddress(null)).toBe(false);
    expect(isWithheldAddress("")).toBe(false);
  });

  it("detects the historical WITTHELD typo placeholder", () => {
    expect(isWithheldAddress("123 Example St. ADDRESS WITTHELD")).toBe(true);
  });

  it("detects the correctly spelled WITHHELD placeholder", () => {
    expect(isWithheldAddress("123 Example St. ADDRESS WITHHELD")).toBe(true);
  });

  it("does not treat real streets as withheld", () => {
    expect(isWithheldAddress("32129 ST HWY 34")).toBe(false);
    expect(isWithheldAddress("4335 Camelot Cir")).toBe(false);
  });
});
