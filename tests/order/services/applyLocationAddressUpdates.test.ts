import { describe, it, expect } from "@jest/globals";
import {
  applyLocationAddressToUpdateDoc,
  applyLocationContactToUpdateDoc,
  applyLocationNotesToUpdateDoc,
  formatLocationAddressForGeocode,
} from "@/order/services/applyLocationAddressUpdates";

describe("applyLocationAddressToUpdateDoc", () => {
  it("maps nested address fields onto dotted $set paths without replacing origin", () => {
    const updateDoc: { $set: Record<string, unknown> } = {
      $set: { paymentType: "billing" },
    };

    const applied = applyLocationAddressToUpdateDoc(updateDoc, "destination", {
      address: "100 Lake Rd",
      city: "Lake Jackson",
      state: "TX",
      zip: "77566",
    });

    expect(applied).toBe(true);
    expect(updateDoc.$set.paymentType).toBe("billing");
    expect(updateDoc.$set["destination.address.address"]).toBe("100 Lake Rd");
    expect(updateDoc.$set["destination.address.city"]).toBe("Lake Jackson");
    expect(updateDoc.$set["destination.address.state"]).toBe("TX");
    expect(updateDoc.$set["destination.address.zip"]).toBe("77566");
    expect(updateDoc.$set["destination"]).toBeUndefined();
  });

  it("pads short numeric zips", () => {
    const updateDoc: { $set: Record<string, unknown> } = { $set: {} };

    applyLocationAddressToUpdateDoc(updateDoc, "origin", {
      zip: "7039",
    });

    expect(updateDoc.$set["origin.address.zip"]).toBe("07039");
  });

  it("returns false when no address fields are present", () => {
    const updateDoc: { $set: Record<string, unknown> } = { $set: {} };

    expect(applyLocationAddressToUpdateDoc(updateDoc, "origin", {})).toBe(
      false,
    );
    expect(applyLocationAddressToUpdateDoc(updateDoc, "origin", null)).toBe(
      false,
    );
  });
});

describe("applyLocationContactToUpdateDoc", () => {
  it("maps contact fields onto dotted $set paths without replacing origin", () => {
    const updateDoc: { $set: Record<string, unknown> } = {
      $set: { paymentType: "billing" },
    };

    const applied = applyLocationContactToUpdateDoc(updateDoc, "origin", {
      companyName: "MMI Warehouse",
      name: "Jane Doe",
    });

    expect(applied).toBe(true);
    expect(updateDoc.$set.paymentType).toBe("billing");
    expect(updateDoc.$set["origin.contact.companyName"]).toBe("MMI Warehouse");
    expect(updateDoc.$set["origin.contact.name"]).toBe("Jane Doe");
    expect(updateDoc.$set["origin"]).toBeUndefined();
  });
});

describe("applyLocationNotesToUpdateDoc", () => {
  it("sets location notes and allows clearing them", () => {
    const updateDoc: { $set: Record<string, unknown> } = { $set: {} };

    expect(applyLocationNotesToUpdateDoc(updateDoc, "destination", "Gate 4")).toBe(
      true,
    );
    expect(updateDoc.$set["destination.notes"]).toBe("Gate 4");
    expect(applyLocationNotesToUpdateDoc(updateDoc, "destination", "  ")).toBe(
      true,
    );
    expect(updateDoc.$set["destination.notes"]).toBe("");
  });
});

describe("formatLocationAddressForGeocode", () => {
  it("fills missing input fields from the existing address", () => {
    expect(
      formatLocationAddressForGeocode(
        { city: "Lake Jackson", state: "TX", zip: "77566" },
        { address: "100 Lake Rd", city: "Freeport", state: "TX", zip: "77541" },
      ),
    ).toBe("100 Lake Rd, Lake Jackson, TX, 77566");
  });
});
