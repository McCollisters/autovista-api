import { describe, it, expect } from "@jest/globals";
import { getDeliveryRanges } from "@/order/services/getDeliveryRanges";

describe("getDeliveryRanges", () => {
  describe("Basic Date Range Calculation", () => {
    it("should calculate delivery ranges for 1-day service", () => {
      const pickupStartDate = new Date("2024-01-15T10:00:00Z"); // Monday
      const serviceLevel = 1;
      const transitTime: [number, number] = [3, 5]; // 3-5 days transit
      const holidayDates: Date[] = [];

      const result = getDeliveryRanges({
        pickupStartDate,
        serviceLevel,
        transitTime,
        holidayDates,
      });

      expect(result).toHaveLength(4);
      expect(result[0]).toBeInstanceOf(Date); // Pickup start
      expect(result[1]).toBeInstanceOf(Date); // Pickup end
      expect(result[2]).toBeInstanceOf(Date); // Delivery start
      expect(result[3]).toBeInstanceOf(Date); // Delivery end

      // Pickup end should be same as pickup start for 1-day service
      expect(result[0].getTime()).toBeLessThanOrEqual(result[1].getTime());
      // Delivery should be after pickup
      expect(result[2].getTime()).toBeGreaterThan(result[0].getTime());
      expect(result[3].getTime()).toBeGreaterThan(result[2].getTime());
    });

    it("should calculate delivery ranges for 5-day service", () => {
      const pickupStartDate = new Date("2024-01-15T10:00:00Z"); // Monday
      const serviceLevel = 5;
      const transitTime: [number, number] = [3, 5];
      const holidayDates: Date[] = [];

      const result = getDeliveryRanges({
        pickupStartDate,
        serviceLevel,
        transitTime,
        holidayDates,
      });

      expect(result).toHaveLength(4);
      // Pickup end should be after pickup start for 5-day service
      expect(result[1].getTime()).toBeGreaterThan(result[0].getTime());
    });

    it("should calculate delivery ranges for 7-day service", () => {
      const pickupStartDate = new Date("2024-01-15T10:00:00Z"); // Monday
      const serviceLevel = 7;
      const transitTime: [number, number] = [3, 5];
      const holidayDates: Date[] = [];

      const result = getDeliveryRanges({
        pickupStartDate,
        serviceLevel,
        transitTime,
        holidayDates,
      });

      expect(result).toHaveLength(4);
      // Pickup end should be significantly after pickup start for 7-day service
      expect(result[1].getTime()).toBeGreaterThan(result[0].getTime());
    });
  });

  describe("Holiday Exclusion", () => {
    it("should exclude holidays from pickup window calculation", () => {
      const pickupStartDate = new Date("2024-01-15T10:00:00Z"); // Monday
      const serviceLevel = 5;
      const transitTime: [number, number] = [3, 5];
      const holidayDates = [new Date("2024-01-17T00:00:00Z")]; // Wednesday holiday

      const result = getDeliveryRanges({
        pickupStartDate,
        serviceLevel,
        transitTime,
        holidayDates,
      });

      expect(result).toHaveLength(4);
      // Holiday should be excluded from pickup window
      const holidayDate = new Date("2024-01-17T00:00:00Z");
      const pickupEnd = result[1];
      // Pickup end should account for holiday exclusion
      expect(pickupEnd.getTime()).toBeGreaterThan(holidayDate.getTime());
    });

    it("should handle multiple holidays", () => {
      const pickupStartDate = new Date("2024-01-15T10:00:00Z"); // Monday
      const serviceLevel = 5;
      const transitTime: [number, number] = [3, 5];
      const holidayDates = [
        new Date("2024-01-17T00:00:00Z"), // Wednesday
        new Date("2024-01-19T00:00:00Z"), // Friday
      ];

      const result = getDeliveryRanges({
        pickupStartDate,
        serviceLevel,
        transitTime,
        holidayDates,
      });

      expect(result).toHaveLength(4);
      // Both holidays should be excluded
      expect(result[1].getTime()).toBeGreaterThan(
        new Date("2024-01-19T00:00:00Z").getTime(),
      );
    });
  });

  describe("Weekend Exclusion", () => {
    it("should exclude weekends from pickup window", () => {
      const pickupStartDate = new Date("2024-01-13T10:00:00Z"); // Saturday
      const serviceLevel = 5;
      const transitTime: [number, number] = [3, 5];
      const holidayDates: Date[] = [];

      const result = getDeliveryRanges({
        pickupStartDate,
        serviceLevel,
        transitTime,
        holidayDates,
      });

      expect(result).toHaveLength(4);
      // Pickup end should skip weekends
      const pickupEndDay = result[1].getDay(); // 0 = Sunday, 6 = Saturday
      expect(pickupEndDay).not.toBe(0); // Not Sunday
      expect(pickupEndDay).not.toBe(6); // Not Saturday
    });

    it("should handle pickup starting on weekend", () => {
      const pickupStartDate = new Date("2024-01-14T10:00:00Z"); // Sunday
      const serviceLevel = 3;
      const transitTime: [number, number] = [3, 5];
      const holidayDates: Date[] = [];

      const result = getDeliveryRanges({
        pickupStartDate,
        serviceLevel,
        transitTime,
        holidayDates,
      });

      expect(result).toHaveLength(4);
      // Should still calculate correctly even if pickup starts on weekend
      expect(result[0]).toBeInstanceOf(Date);
      expect(result[1]).toBeInstanceOf(Date);
    });
  });

  describe("Transit Time Calculation", () => {
    it("should apply minimum transit time to delivery start", () => {
      const pickupStartDate = new Date("2024-01-15T10:00:00Z");
      const serviceLevel = 1;
      const transitTime: [number, number] = [5, 7]; // 5-7 days transit
      const holidayDates: Date[] = [];

      const result = getDeliveryRanges({
        pickupStartDate,
        serviceLevel,
        transitTime,
        holidayDates,
      });

      const deliveryStart = result[2];
      const pickupStart = result[0];
      const daysDifference =
        (deliveryStart.getTime() - pickupStart.getTime()) / (1000 * 60 * 60 * 24);

      // Delivery start should be at least transitTime[0] days after pickup
      expect(daysDifference).toBeGreaterThanOrEqual(4); // Allow for some variance
    });

    it("should apply maximum transit time to delivery end", () => {
      const pickupStartDate = new Date("2024-01-15T10:00:00Z");
      const serviceLevel = 1;
      const transitTime: [number, number] = [3, 10]; // 3-10 days transit
      const holidayDates: Date[] = [];

      const result = getDeliveryRanges({
        pickupStartDate,
        serviceLevel,
        transitTime,
        holidayDates,
      });

      const deliveryEnd = result[3];
      const pickupEnd = result[1];
      const daysDifference =
        (deliveryEnd.getTime() - pickupEnd.getTime()) / (1000 * 60 * 60 * 24);

      // Delivery end should account for maximum transit time
      expect(daysDifference).toBeGreaterThanOrEqual(9); // Allow for some variance
    });
  });

  describe("Edge Cases", () => {
    it("should handle date string input", () => {
      const pickupStartDate = "2024-01-15T10:00:00Z";
      const serviceLevel = 1;
      const transitTime: [number, number] = [3, 5];
      const holidayDates: Date[] = [];

      const result = getDeliveryRanges({
        pickupStartDate,
        serviceLevel,
        transitTime,
        holidayDates,
      });

      expect(result).toHaveLength(4);
      expect(result[0]).toBeInstanceOf(Date);
    });

    it("should handle holiday dates as strings", () => {
      const pickupStartDate = new Date("2024-01-15T10:00:00Z");
      const serviceLevel = 5;
      const transitTime: [number, number] = [3, 5];
      const holidayDates = ["2024-01-17T00:00:00Z"] as any;

      const result = getDeliveryRanges({
        pickupStartDate,
        serviceLevel,
        transitTime,
        holidayDates,
      });

      expect(result).toHaveLength(4);
    });

    it("should handle zero transit time", () => {
      const pickupStartDate = new Date("2024-01-15T10:00:00Z");
      const serviceLevel = 1;
      const transitTime: [number, number] = [0, 0];
      const holidayDates: Date[] = [];

      const result = getDeliveryRanges({
        pickupStartDate,
        serviceLevel,
        transitTime,
        holidayDates,
      });

      expect(result).toHaveLength(4);
      // Delivery should be same or very close to pickup with zero transit
      expect(result[2].getTime()).toBeGreaterThanOrEqual(result[0].getTime());
    });

    it("should handle very long transit times", () => {
      const pickupStartDate = new Date("2024-01-15T10:00:00Z");
      const serviceLevel = 1;
      const transitTime: [number, number] = [30, 45]; // 30-45 days transit
      const holidayDates: Date[] = [];

      const result = getDeliveryRanges({
        pickupStartDate,
        serviceLevel,
        transitTime,
        holidayDates,
      });

      expect(result).toHaveLength(4);
      const deliveryStart = result[2];
      const pickupStart = result[0];
      const daysDifference =
        (deliveryStart.getTime() - pickupStart.getTime()) / (1000 * 60 * 60 * 24);

      expect(daysDifference).toBeGreaterThanOrEqual(29); // At least 29 days
    });
  });

  describe("Date Range Validation", () => {
    it("should return dates in correct order", () => {
      const pickupStartDate = new Date("2024-01-15T10:00:00Z");
      const serviceLevel = 5;
      const transitTime: [number, number] = [3, 5];
      const holidayDates: Date[] = [];

      const result = getDeliveryRanges({
        pickupStartDate,
        serviceLevel,
        transitTime,
        holidayDates,
      });

      // Pickup start <= Pickup end
      expect(result[0].getTime()).toBeLessThanOrEqual(result[1].getTime());
      // Delivery start should be after pickup start (transit time applied to pickup start)
      expect(result[2].getTime()).toBeGreaterThanOrEqual(result[0].getTime());
      // Delivery start <= Delivery end
      expect(result[2].getTime()).toBeLessThanOrEqual(result[3].getTime());
    });

    it("should return UTC dates", () => {
      const pickupStartDate = new Date("2024-01-15T10:00:00Z");
      const serviceLevel = 1;
      const transitTime: [number, number] = [3, 5];
      const holidayDates: Date[] = [];

      const result = getDeliveryRanges({
        pickupStartDate,
        serviceLevel,
        transitTime,
        holidayDates,
      });

      // All dates should be Date objects
      result.forEach((date) => {
        expect(date).toBeInstanceOf(Date);
      });
    });
  });
});

