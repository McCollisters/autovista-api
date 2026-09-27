import { describe, it, expect, afterEach } from "@jest/globals";

jest.mock("@/core/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  codPaymentUrlForOrder,
  orderPayloadWithCodPaymentUrl,
} from "@/_global/utils/getCodPaymentHostedUrl";

describe("codPaymentUrlForOrder", () => {
  const originalUrl = process.env.CONVERGE_HOSTED_PAYMENT_URL;

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.CONVERGE_HOSTED_PAYMENT_URL;
    } else {
      process.env.CONVERGE_HOSTED_PAYMENT_URL = originalUrl;
    }
  });

  it("adds the configured checkout link only for an unpaid COD order", () => {
    process.env.CONVERGE_HOSTED_PAYMENT_URL =
      "https://payments.example.test/checkout";

    expect(
      orderPayloadWithCodPaymentUrl({ paymentType: "COD", hasPaid: false }),
    ).toEqual({
      paymentType: "COD",
      hasPaid: false,
      codPaymentUrl: "https://payments.example.test/checkout",
    });

    expect(
      codPaymentUrlForOrder({ paymentType: "billing", hasPaid: false }),
    ).toBe("");
    expect(codPaymentUrlForOrder({ paymentType: "cod", hasPaid: true })).toBe(
      "",
    );
  });
});
