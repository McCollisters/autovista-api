import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { handleCarrierCanceled } from "@/\u005fglobal/integrations/webhooks/handlers";

jest.mock("@/_global/models", () => ({
  Order: {
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
  Carrier: {
    findOne: jest.fn(),
  },
}));

jest.mock("@/order/integrations/updateSuperWithPartialOrder", () => ({
  updateSuperWithPartialOrder: jest.fn(),
}));

const { Order, Carrier } = require("@/_global/models");
const {
  updateSuperWithPartialOrder,
} = require("@/order/integrations/updateSuperWithPartialOrder");

describe("handleCarrierCanceled", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates Super Dispatch order to partial after carrier cancellation", async () => {
    const order = {
      _id: "order-id",
      refId: "12345",
      tms: {
        guid: "sd-guid",
        status: "available",
        createdAt: null,
        updatedAt: null,
      },
      tmsPartialOrder: false,
    };

    const carrierDoc = { activity: [], save: jest.fn() };

    Order.findOne.mockResolvedValue(order);
    Carrier.findOne.mockResolvedValue(carrierDoc);
    updateSuperWithPartialOrder.mockResolvedValue({
      status: "available",
      created_at: "2024-01-01T00:00:00.000Z",
      changed_at: "2024-01-02T00:00:00.000Z",
    });

    const response = await handleCarrierCanceled(
      { order_guid: "sd-guid", carrier_guid: "carrier-guid" },
      {},
    );

    expect(Order.findOne).toHaveBeenCalledWith({ "tms.guid": "sd-guid" });
    expect(updateSuperWithPartialOrder).toHaveBeenCalledWith(order);
    expect(Order.findByIdAndUpdate).toHaveBeenCalledWith(order._id, {
      $set: {
        tms: {
          guid: "sd-guid",
          status: "available",
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
          updatedAt: new Date("2024-01-02T00:00:00.000Z"),
        },
        tmsPartialOrder: true,
      },
    });
    expect(response.success).toBe(true);
  });
});
