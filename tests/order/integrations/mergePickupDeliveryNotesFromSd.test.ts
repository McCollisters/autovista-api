import { describe, it, expect } from "@jest/globals";
import { mergePickupDeliveryNotesFromSd } from "@/order/integrations/updateOrderFromSD";

describe("mergePickupDeliveryNotesFromSd", () => {
  describe("partial order (tmsPartialOrder true)", () => {
    it("keeps existing DB notes when SD has no notes", () => {
      expect(
        mergePickupDeliveryNotesFromSd(true, undefined, "Gate code 123"),
      ).toBe("Gate code 123");
    });

    it("keeps existing DB notes when SD sends empty string", () => {
      expect(mergePickupDeliveryNotesFromSd(true, "", "Our pickup note")).toBe(
        "Our pickup note",
      );
    });

    it("keeps existing DB notes when SD sends whitespace-only", () => {
      expect(mergePickupDeliveryNotesFromSd(true, "   ", "Keep me")).toBe(
        "Keep me",
      );
    });

    it("ignores non-empty SD notes and keeps DB notes", () => {
      expect(
        mergePickupDeliveryNotesFromSd(
          true,
          "SD should not win",
          "DB is source of truth",
        ),
      ).toBe("DB is source of truth");
    });

    it("returns undefined when both sides empty", () => {
      expect(mergePickupDeliveryNotesFromSd(true, "", undefined)).toBeUndefined();
    });
  });

  describe("full order in SD (tmsPartialOrder false)", () => {
    it("uses SD notes when present", () => {
      expect(
        mergePickupDeliveryNotesFromSd(false, "Updated from carrier", "Old"),
      ).toBe("Updated from carrier");
    });

    it("preserves existing when SD notes empty", () => {
      expect(
        mergePickupDeliveryNotesFromSd(false, "", "Still in DB"),
      ).toBe("Still in DB");
    });

    it("preserves existing when SD notes null/undefined", () => {
      expect(
        mergePickupDeliveryNotesFromSd(false, undefined, "Only in DB"),
      ).toBe("Only in DB");
    });

    it("preserves existing when SD notes whitespace-only", () => {
      expect(
        mergePickupDeliveryNotesFromSd(false, "  \t  ", "Whitespace SD"),
      ).toBe("Whitespace SD");
    });
  });
});
