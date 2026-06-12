import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  handleCarrierCanceled,
  handleSuperDispatchOrderModified,
  handleSuperDispatchVehicleModified,
} from "@/\u005fglobal/integrations/webhooks/handlers";

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

jest.mock("@/order/integrations/saveSDUpdatesToDB", () => ({
  syncOrderFromSdWebhook: jest.fn(),
}));

const { Order, Carrier } = require("@/_global/models");
const {
  updateSuperWithPartialOrder,
} = require("@/order/integrations/updateSuperWithPartialOrder");
const { syncOrderFromSdWebhook } = require("@/order/integrations/saveSDUpdatesToDB");

describe("handleSuperDispatchOrderModified", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("syncs order from Super Dispatch on order.modified webhook", async () => {
    const order = {
      _id: "order-id",
      refId: "12345",
      tms: { guid: "sd-guid" },
      tmsPartialOrder: true,
      save: jest.fn(),
    };

    Order.findOne.mockResolvedValue(order);
    syncOrderFromSdWebhook.mockResolvedValue(undefined);

    const response = await handleSuperDispatchOrderModified(
      { order_guid: "sd-guid" },
      {},
    );

    expect(syncOrderFromSdWebhook).toHaveBeenCalledWith(order);
    expect(order.save).not.toHaveBeenCalled();
    expect(response.success).toBe(true);
  });
});

describe("handleSuperDispatchVehicleModified", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("syncs order from Super Dispatch on vehicle.modified webhook", async () => {
    const order = {
      _id: "order-id",
      refId: "12345",
      tms: { guid: "sd-guid" },
      tmsPartialOrder: true,
      save: jest.fn(),
    };

    Order.findOne.mockResolvedValue(order);
    syncOrderFromSdWebhook.mockResolvedValue(undefined);

    const response = await handleSuperDispatchVehicleModified(
      { order_guid: "sd-guid" },
      {},
    );

    expect(syncOrderFromSdWebhook).toHaveBeenCalledWith(order);
    expect(order.save).not.toHaveBeenCalled();
    expect(response.success).toBe(true);
  });
});

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
