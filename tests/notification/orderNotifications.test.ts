import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { sendOrderNotification } from "@/notification/orderNotifications";
import { Order } from "@/_global/models";

const sendMock = jest.fn();

jest.mock("@/notification/index", () => ({
  getNotificationManager: () => ({
    send: sendMock,
  }),
}));

jest.mock("@/_global/models", () => ({
  Order: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

describe("sendOrderNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendMock.mockResolvedValue({
      email: { success: true, provider: "sendgrid" },
      sms: undefined,
    });
    (Order.findById as jest.Mock).mockResolvedValue({ _id: "order-1" });
    (Order.findByIdAndUpdate as jest.Mock).mockResolvedValue({ _id: "order-1" });
  });

  it("defaults templateName to notification type", async () => {
    const result = await sendOrderNotification({
      orderId: "order-1",
      type: "customerConfirmation",
      email: {
        to: "user@example.com",
        subject: "Hello",
        html: "<p>Hi</p>",
      },
    });

    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: expect.objectContaining({
          templateName: "customerConfirmation",
        }),
      }),
    );
  });

  it("preserves templateName when provided", async () => {
    const result = await sendOrderNotification({
      orderId: "order-1",
      type: "customerConfirmation",
      email: {
        to: "user@example.com",
        subject: "Hello",
        html: "<p>Hi</p>",
        templateName: "Custom Template",
      },
    });

    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: expect.objectContaining({
          templateName: "Custom Template",
        }),
      }),
    );
  });
});
