import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import Handlebars from "handlebars";
import { PaymentType, TransportType } from "@/_global/enums";
import type { IOrder } from "@/_global/models";
import { Portal } from "@/_global/models";
import { readFile } from "fs/promises";
import { sendOrderCustomerPublicNew } from "@/order/notifications/sendOrderCustomerPublicNew";
import { sendOrderNotification } from "@/notification/orderNotifications";

jest.mock("@/_global/models", () => ({
  Portal: {
    findById: jest.fn(),
  },
}));

jest.mock("@/notification/orderNotifications", () => ({
  sendOrderNotification: jest.fn(),
}));

jest.mock("fs/promises", () => ({
  readFile: jest.fn(),
}));

jest.mock("@/email/services/getEmailTemplate", () => ({
  getEmailTemplate: jest
    .fn()
    .mockResolvedValue({
      senderEmail: "autologistics@mccollisters.com",
      senderName: "McCollister's",
    } as never),
}));

describe("sendOrderCustomerPublicNew", () => {
  let lastTemplateData: Record<string, unknown> | undefined;
  let compileSpy: jest.SpiedFunction<typeof Handlebars.compile>;

  const baseOrder = (): IOrder =>
    ({
      _id: "507f1f77bcf86cd799439011",
      refId: 300001,
      portalId: "test-portal-id",
      paymentType: PaymentType.Cod,
      customer: {
        email: "booker@example.com",
        name: "Alex Booker",
      },
      origin: { address: { city: "Austin", state: "TX" } },
      destination: { address: { city: "Denver", state: "CO" } },
      transportType: TransportType.Open,
      vehicles: [],
      schedule: {
        serviceLevel: "1",
        pickupSelected: new Date(),
        pickupEstimated: [new Date(), new Date()],
        deliveryEstimated: [new Date(), new Date()],
      },
    }) as unknown as IOrder;

  beforeEach(() => {
    jest.clearAllMocks();
    lastTemplateData = undefined;

    (Portal.findById as jest.MockedFunction<typeof Portal.findById>).mockResolvedValue(
      { companyName: "Test Co" } as never,
    );
    (readFile as jest.MockedFunction<typeof readFile>).mockResolvedValue(
      "<html>{{refId}}</html>" as never,
    );

    (sendOrderNotification as jest.MockedFunction<typeof sendOrderNotification>).mockResolvedValue(
      { success: true } as never,
    );

    compileSpy = jest.spyOn(Handlebars, "compile").mockImplementation(() => {
      return ((data: Record<string, unknown>) => {
        lastTemplateData = data;
        return "<html/>";
      }) as ReturnType<typeof Handlebars.compile>;
    });
  });

  afterEach(() => {
    compileSpy.mockRestore();
  });

  it("confirmation + COD: shows payment section and uses sections 6 / 7", async () => {
    await sendOrderCustomerPublicNew(baseOrder());

    expect(lastTemplateData?.showPaymentSection).toBe(true);
    expect(lastTemplateData?.sectionNextNumber).toBe("6");
    expect(lastTemplateData?.sectionNotesNumber).toBe("7");
    expect(lastTemplateData?.isShareRecipient).toBe(false);

    expect(sendOrderNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        email: expect.objectContaining({
          subject: "Your McCollister's Auto Transport Order Is Confirmed",
        }),
      }),
    );
  });

  it("share + COD: omits payment section and uses sections 5 / 6", async () => {
    await sendOrderCustomerPublicNew(baseOrder(), {
      recipientEmail: "friend@example.com",
      variant: "share",
    });

    expect(lastTemplateData?.showPaymentSection).toBe(false);
    expect(lastTemplateData?.sectionNextNumber).toBe("5");
    expect(lastTemplateData?.sectionNotesNumber).toBe("6");
    expect(lastTemplateData?.isShareRecipient).toBe(true);
    expect(lastTemplateData?.sharerName).toBe("Alex Booker");

    expect(sendOrderNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        email: expect.objectContaining({
          subject: "A McCollister's auto transport order was shared with you",
        }),
      }),
    );
  });

  it("readFile loads customer-order-new template", async () => {
    await sendOrderCustomerPublicNew(baseOrder());
    expect(readFile).toHaveBeenCalled();
    const paths = (readFile as jest.Mock).mock.calls.map((c) => c[0] as string);
    expect(paths.some((p) => String(p).includes("customer-order-new"))).toBe(
      true,
    );
  });
});
