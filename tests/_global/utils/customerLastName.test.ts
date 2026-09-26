import { describe, it, expect } from "@jest/globals";
import {
  customerLastNameMatches,
  normalizePersonNamePart,
  resolveCustomerLastName,
} from "@/_global/utils/customerLastName";

describe("customerLastName", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizePersonNamePart("  Smith ")).toBe("smith");
  });

  it("prefers structured lastName", () => {
    expect(
      resolveCustomerLastName({ lastName: "Smith", name: "Jane Doe" }),
    ).toBe("smith");
  });

  it("falls back to the last word of full name", () => {
    expect(resolveCustomerLastName({ name: "Jane Mary Doe" })).toBe("doe");
  });

  it("requires an exact last-name match (not substring)", () => {
    expect(
      customerLastNameMatches({ name: "Jonathan Smith" }, "nathan"),
    ).toBe(false);
    expect(
      customerLastNameMatches({ name: "Jonathan Smith" }, "Smith"),
    ).toBe(true);
    expect(
      customerLastNameMatches({ lastName: "Smith", name: "Jon Smith" }, "smith"),
    ).toBe(true);
  });
});
