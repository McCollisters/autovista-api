import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { EmailService } from "@/notification/email";
import { EmailProvider } from "@/notification/types";
import { logger } from "@/core/logger";

jest.mock("@/core/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("EmailService", () => {
  const mockedLogger = logger as unknown as {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };

  const createEmailService = () => {
    const provider: EmailProvider = {
      sendEmail: jest.fn().mockResolvedValue({
        success: true,
        messageId: "message-id",
        provider: "sendgrid",
      }),
    };

    return new EmailService(
      provider,
      true,
      "sender@example.com",
      "reply@example.com",
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NOTIFICATION_OVERRIDE_EMAIL;
  });

  it("logs email template and recipient details", async () => {
    const emailService = createEmailService();

    await emailService.send({
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      templateName: "Test Template",
    });

    expect(mockedLogger.info).toHaveBeenCalledWith(
      "Preparing email notification",
      expect.objectContaining({
        label: "email",
        templateName: "Test Template",
        emailAddress: "sender@example.com",
        recipient: "user@example.com",
        subject: "Hello",
      }),
    );
  });

  it("logs override recipient when routing to a single inbox", async () => {
    const emailService = createEmailService();
    process.env.NOTIFICATION_OVERRIDE_EMAIL = "override@example.com";

    await emailService.send({
      to: ["a@example.com", "b@example.com"],
      subject: "Override",
      text: "Hi",
      templateName: "Override Template",
    });

    expect(mockedLogger.info).toHaveBeenCalledWith(
      "Preparing email notification",
      expect.objectContaining({
        label: "email",
        templateName: "Override Template",
        recipient: "override@example.com",
        overrideRecipient: "override@example.com",
        to: "override@example.com",
      }),
    );
  });
});
