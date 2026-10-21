import { describe, it, expect } from "@jest/globals";
import { formatNotificationRecipientList } from "@/notification/formatNotificationRecipientList";
import { resolveAgentNotificationRecipients } from "@/order/notifications/resolveAgentNotificationRecipients";

const portalList = [
  {
    name: "Jessa Vargas",
    email: "jvargas@mccollisters.com",
    pickup: true,
    delivery: true,
  },
  {
    name: "Ginger Lyn Chua",
    email: "gchua@mccollisters.com",
    pickup: true,
    delivery: false,
  },
  {
    name: "Gilbert Dala",
    email: "gdala@mccollisters.com",
    pickup: false,
    delivery: false,
  },
];

describe("formatNotificationRecipientList", () => {
  it("keeps each address once", () => {
    expect(
      formatNotificationRecipientList([
        "jvargas@mccollisters.com",
        "JVargas@mccollisters.com",
        "gchua@mccollisters.com",
        "unknown",
        "",
      ]),
    ).toBe("jvargas@mccollisters.com, gchua@mccollisters.com");
  });
});

describe("resolveAgentNotificationRecipients", () => {
  it("includes portal addresses only for the option they have enabled", () => {
    const pickup = resolveAgentNotificationRecipients({
      portalEmails: portalList,
      type: "pickup",
    });
    const delivery = resolveAgentNotificationRecipients({
      portalEmails: portalList,
      type: "delivery",
    });

    expect(pickup.recipients.map((recipient) => recipient.email)).toEqual([
      "jvargas@mccollisters.com",
      "gchua@mccollisters.com",
    ]);
    expect(delivery.recipients.map((recipient) => recipient.email)).toEqual([
      "jvargas@mccollisters.com",
    ]);
  });

  it("includes an order agent who is not on the portal list when they requested the notification", () => {
    const { recipients } = resolveAgentNotificationRecipients({
      agents: [
        {
          name: "Outside Agent",
          email: "outside@example.com",
          enablePickupNotifications: true,
          enableDeliveryNotifications: false,
        },
      ],
      portalEmails: portalList,
      type: "pickup",
    });

    expect(recipients.map((recipient) => recipient.email)).toEqual([
      "outside@example.com",
      "jvargas@mccollisters.com",
      "gchua@mccollisters.com",
    ]);
  });

  it("sends one email when the order agent is also on the portal list", () => {
    const { recipients } = resolveAgentNotificationRecipients({
      agents: [
        {
          name: "Jessa Vargas",
          email: "JVargas@mccollisters.com",
          enablePickupNotifications: true,
          enableDeliveryNotifications: true,
        },
      ],
      portalEmails: portalList,
      type: "pickup",
    });

    expect(recipients).toEqual([
      {
        name: "Jessa Vargas",
        email: "JVargas@mccollisters.com",
      },
      {
        name: "Ginger Lyn Chua",
        email: "gchua@mccollisters.com",
      },
    ]);
  });

  it("still emails a portal subscriber when the same person opted out on the order", () => {
    const { recipients } = resolveAgentNotificationRecipients({
      agents: [
        {
          name: "Jessa Vargas",
          email: "jvargas@mccollisters.com",
          enablePickupNotifications: false,
        },
      ],
      portalEmails: portalList,
      type: "pickup",
    });

    expect(recipients.map((recipient) => recipient.email)).toEqual([
      "jvargas@mccollisters.com",
      "gchua@mccollisters.com",
    ]);
  });

  it("emails an order agent who requested pickup even when their portal option is off", () => {
    const { recipients } = resolveAgentNotificationRecipients({
      agents: [
        {
          name: "Gilbert Dala",
          email: "gdala@mccollisters.com",
          enablePickupNotifications: true,
        },
      ],
      portalEmails: portalList,
      type: "pickup",
    });

    expect(recipients.map((recipient) => recipient.email)).toEqual([
      "gdala@mccollisters.com",
      "jvargas@mccollisters.com",
      "gchua@mccollisters.com",
    ]);
  });

  it("uses the order agent's request ahead of a legacy pickup flag", () => {
    const { agentRecipients } = resolveAgentNotificationRecipients({
      agents: [
        {
          email: "agent@example.com",
          pickup: true,
          enablePickupNotifications: false,
        },
      ],
      type: "pickup",
    });

    expect(agentRecipients).toEqual([]);
  });

  it("falls back to legacy agent flags when the current request fields are absent", () => {
    const { recipients } = resolveAgentNotificationRecipients({
      agents: [{ email: "legacy@example.com", emailDelivery: true }],
      type: "delivery",
    });

    expect(recipients.map((recipient) => recipient.email)).toEqual([
      "legacy@example.com",
    ]);
  });

  it("keeps Sirva domestic and non-domestic portal filters", () => {
    const portalEmails = [
      { email: "domestic@example.com", pickup: true, sirvadomestic: true },
      {
        email: "international@example.com",
        pickup: true,
        sirvanondomestic: true,
      },
      { email: "neither@example.com", pickup: true },
    ];

    const domestic = resolveAgentNotificationRecipients({
      portalEmails,
      type: "pickup",
      isSirva: true,
    });
    const international = resolveAgentNotificationRecipients({
      portalEmails,
      type: "pickup",
      isSirva: true,
      isSirvaNonDomestic: true,
    });

    expect(domestic.recipients.map((recipient) => recipient.email)).toEqual([
      "domestic@example.com",
    ]);
    expect(
      international.recipients.map((recipient) => recipient.email),
    ).toEqual(["international@example.com"]);
  });
});
