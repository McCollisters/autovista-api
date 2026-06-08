import { describe, it, expect } from "@jest/globals";
import { TransportType } from "@/_global/enums";
import { formatOrderStatusDetailEmailDates } from "@/order/notifications/utils/formatOrderStatusDetailEmailDates";

describe("formatOrderStatusDetailEmailDates", () => {
  it("matches OrderStatusDetail 1-day estimated pickup range display", () => {
    const pickupStart = new Date(2026, 5, 12);
    const result = formatOrderStatusDetailEmailDates({
      transportType: TransportType.Open,
      schedule: {
        serviceLevel: "1",
        pickupSelected: pickupStart,
        pickupEstimated: [pickupStart, pickupStart],
        deliveryEstimated: [new Date(2026, 5, 15), new Date(2026, 5, 26)],
      },
    } as never);

    expect(result.pickupDetailDisplay).toBe(
      "06.12.2026–06.13.2026 (Estimated)",
    );
    expect(result.deliveryDetailDisplay).toBe(
      "06.15.2026–06.26.2026 (Estimated range based on transit time)",
    );
  });

  it("shows single date for exact pickup", () => {
    const pickupStart = new Date(2026, 5, 12);
    const result = formatOrderStatusDetailEmailDates({
      transportType: TransportType.Open,
      pickup: { pickupDateType: "exact" },
      schedule: {
        serviceLevel: "1",
        pickupSelected: pickupStart,
        pickupEstimated: [pickupStart, pickupStart],
        deliveryEstimated: [pickupStart, pickupStart],
      },
    } as never);

    expect(result.pickupDetailDisplay).toBe("06.12.2026 (Exact)");
  });
});
