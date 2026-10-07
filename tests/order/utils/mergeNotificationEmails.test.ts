import { describe, it, expect } from "@jest/globals";
import { mergeNotificationEmails } from "@/order/utils/mergeNotificationEmails";

describe("mergeNotificationEmails", () => {
  it("adds a booking agent with pickup and delivery off", () => {
    const merged = mergeNotificationEmails(
      [
        {
          email: "existing@example.com",
          name: "Existing",
          pickup: true,
          delivery: true,
        },
      ],
      [
        {
          email: "booker@example.com",
          name: "Booker",
          pickup: true,
          delivery: true,
        },
      ],
    );

    expect(merged).toEqual([
      {
        email: "existing@example.com",
        name: "Existing",
        pickup: true,
        delivery: true,
      },
      {
        email: "booker@example.com",
        name: "Booker",
        pickup: false,
        delivery: false,
      },
    ]);
  });

  it("does not turn notifications on for someone already on the list", () => {
    const merged = mergeNotificationEmails(
      [
        {
          email: "chilty@movebms.com",
          name: "Christine Hilty",
          pickup: false,
          delivery: false,
        },
      ],
      [
        {
          email: "Chilty@MoveBMS.com",
          name: "Christine Hilty",
          pickup: true,
          delivery: true,
        },
      ],
    );

    expect(merged).toEqual([
      {
        email: "chilty@movebms.com",
        name: "Christine Hilty",
        pickup: false,
        delivery: false,
      },
    ]);
  });

  it("keeps an existing subscriber's options when they book again", () => {
    const merged = mergeNotificationEmails(
      [{ email: "agent@example.com", pickup: true, delivery: false }],
      [{ email: "agent@example.com", pickup: true, delivery: true }],
    );

    expect(merged).toEqual([
      { email: "agent@example.com", pickup: true, delivery: false },
    ]);
  });
});
