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
      origin: {
        contact: {
          companyName: "Pickup Co",
          name: "Pat Pickup",
          email: "pickup@example.com",
          phone: "111-111-1111",
          phoneMobile: "222-222-2222",
          phoneAlt: "333-333-3333",
        },
        address: {
          address: "123 Pickup St",
          city: "Austin",
          state: "TX",
          zip: "78701",
        },
        notes: "Gate code 1234",
      },
      destination: {
        contact: {
          companyName: "Delivery Co",
          name: "Dani Delivery",
          email: "delivery@example.com",
          phone: "444-444-4444",
          phoneMobile: "555-555-5555",
          phoneAlt: "666-666-6666",
        },
        address: {
          address: "789 Delivery Ave",
          city: "Denver",
          state: "CO",
          zip: "80202",
        },
        notes: "Call on arrival",
      },
      pickup: {
        pickupBusinessName: "Pickup Warehouse",
        pickupContactName: "Pat Pickup",
        pickupEmail: "pickup-location@example.com",
        pickupPhone: "111-111-1111",
        pickupMobilePhone: "222-222-2222",
        pickupAltPhone: "333-333-3333",
        pickupAddress: "123 Pickup St",
        pickupCity: "Austin",
        pickupState: "TX",
        pickupZip: "78701",
        pickupNotes: "Gate code 1234",
      },
      delivery: {
        deliveryBusinessName: "Delivery Depot",
        deliveryContactName: "Dani Delivery",
        deliveryEmail: "delivery-location@example.com",
        deliveryPhone: "444-444-4444",
        deliveryMobilePhone: "555-555-5555",
        deliveryAltPhone: "666-666-6666",
        deliveryAddress: "789 Delivery Ave",
        deliveryCity: "Denver",
        deliveryState: "CO",
        deliveryZip: "80202",
        deliveryNotes: "Call on arrival",
      },
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

  it("uses the auto transport sender and passes full location details", async () => {
    await sendOrderCustomerPublicNew(baseOrder());

    expect(sendOrderNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        email: expect.objectContaining({
          from: "autotransport@mccollisters.com",
          fromName: "McCollister's Auto Transport",
          replyTo: "autotransport@mccollisters.com",
        }),
      }),
    );

    expect(lastTemplateData?.pickupDetails).toEqual(
      expect.objectContaining({
        businessName: "Pickup Warehouse",
        contactName: "Pat Pickup",
        email: "pickup-location@example.com",
        phone: "111-111-1111",
        mobilePhone: "222-222-2222",
        alternativePhone: "333-333-3333",
        addressLine1Display: "123 Pickup St",
        addressLine2Display: "Austin, TX 78701",
        notes: "Gate code 1234",
      }),
    );
    expect(lastTemplateData?.deliveryDetails).toEqual(
      expect.objectContaining({
        businessName: "Delivery Depot",
        contactName: "Dani Delivery",
        email: "delivery-location@example.com",
        phone: "444-444-4444",
        mobilePhone: "555-555-5555",
        alternativePhone: "666-666-6666",
        addressLine1Display: "789 Delivery Ave",
        addressLine2Display: "Denver, CO 80202",
        notes: "Call on arrival",
      }),
    );
  });
});
