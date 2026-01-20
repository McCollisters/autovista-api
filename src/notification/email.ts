/**
 * Email Service
 *
 * This service handles sending emails using different providers
 */

import { logger } from "@/core/logger";
import { EmailOptions, EmailProvider, NotificationResult } from "./types";

/**
 * SendGrid Email Provider
 * Uses SendGrid API for sending emails
 */
export class SendGridEmailProvider implements EmailProvider {
  private readonly apiKey: string;
  private readonly fromAddress: string;
  private readonly fromName?: string;
  private readonly replyTo?: string;

  constructor(
    apiKey: string,
    fromAddress: string,
    fromName?: string,
    replyTo?: string,
  ) {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
    this.fromName = fromName;
    this.replyTo = replyTo;
  }

  async sendEmail(options: EmailOptions): Promise<NotificationResult> {
    try {
      // Import SendGrid SDK dynamically
      const sgMailModule = await import("@sendgrid/mail");
      const sgMail = sgMailModule.default;

      sgMail.setApiKey(this.apiKey);

      // Format recipient addresses
      const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
      const ccAddresses = options.cc
        ? Array.isArray(options.cc)
          ? options.cc
          : [options.cc]
        : [];
      const bccAddresses = options.bcc
        ? Array.isArray(options.bcc)
          ? options.bcc
          : [options.bcc]
        : [];

      const fromEmail = options.from || this.fromAddress;
      const fromField = this.fromName
        ? {
            email: fromEmail,
            name: this.fromName,
          }
        : fromEmail;

      const msg = {
        to: toAddresses,
        from: fromField,
        cc: ccAddresses.length > 0 ? ccAddresses : undefined,
        bcc: bccAddresses.length > 0 ? bccAddresses : undefined,
        replyTo: options.replyTo || this.replyTo,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments?.map((att) => ({
          content:
            typeof att.content === "string"
              ? att.content
              : att.content.toString("base64"),
          filename: att.filename,
          type: att.contentType,
          disposition: "attachment",
        })),
      };

      const response = await sgMail.send(msg as any);

      logger.info("Email sent via SendGrid", {
        statusCode: response[0].statusCode,
        to: toAddresses,
        subject: options.subject,
      });

      return {
        success: true,
        messageId: response[0].headers["x-message-id"] as string,
        provider: "sendgrid",
      };
    } catch (error) {
      logger.error("Error sending email via SendGrid:", error);

      // SendGrid errors have a response property with more details
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "response" in error
            ? JSON.stringify((error as any).response?.body || error)
            : String(error);

      return {
        success: false,
        error: errorMessage,
        provider: "sendgrid",
      };
    }
  }
}

/**
 * Email Service Manager
 * Manages email sending using configured provider
 */
export class EmailService {
  private provider: EmailProvider;
  private enabled: boolean;
  private defaultFrom?: string;
  private defaultReplyTo?: string;

  constructor(
    provider: EmailProvider,
    enabled: boolean = true,
    defaultFrom?: string,
    defaultReplyTo?: string,
  ) {
    this.provider = provider;
    this.enabled = enabled;
    this.defaultFrom = defaultFrom;
    this.defaultReplyTo = defaultReplyTo;
  }

  async send(options: EmailOptions): Promise<NotificationResult> {
    if (!this.enabled) {
      logger.warn("Email service is disabled, skipping email send");
      return {
        success: false,
        error: "Email service is disabled",
      };
    }

    // Optional override: route all notifications to a single inbox.
    const overrideRecipient = process.env.NOTIFICATION_OVERRIDE_EMAIL;

    // Apply default from address if not provided
    const emailOptions: EmailOptions = {
      ...options,
      from: options.from || this.defaultFrom,
      replyTo: options.replyTo || this.defaultReplyTo,
      ...(overrideRecipient
        ? {
            to: overrideRecipient,
            cc: undefined,
            bcc: undefined,
          }
        : {}),
    };

    const toAddresses = Array.isArray(emailOptions.to)
      ? emailOptions.to
      : [emailOptions.to];

    logger.info("Preparing email notification", {
      label: "email",
      templateName: emailOptions.templateName || "unknown",
      emailAddress: emailOptions.from || null,
      recipient: toAddresses.length === 1 ? toAddresses[0] : toAddresses,
      overrideRecipient: overrideRecipient || null,
      to: emailOptions.to,
      cc: emailOptions.cc,
      bcc: emailOptions.bcc,
      subject: emailOptions.subject,
    });

    return await this.provider.sendEmail(emailOptions);
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
