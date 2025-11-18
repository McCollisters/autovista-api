/**
 * SMS Service
 *
 * This service handles sending SMS messages using different providers
 */

import { logger } from "@/core/logger";
import { SMSOptions, SMSProvider, NotificationResult } from "./types";

/**
 * AWS SNS SMS Provider
 * Uses Amazon Simple Notification Service for sending SMS
 */
export class AWSSNSProvider implements SMSProvider {
  private readonly defaultFrom?: string;

  constructor(defaultFrom?: string) {
    this.defaultFrom = defaultFrom;
  }

  async sendSMS(options: SMSOptions): Promise<NotificationResult> {
    try {
      // Import AWS SDK dynamically
      const { SNSClient, PublishCommand } = await import("@aws-sdk/client-sns");

      const snsClient = new SNSClient({
        region: process.env.AWS_REGION || "us-east-1",
      });

      const command = new PublishCommand({
        PhoneNumber: options.to,
        Message: options.message,
        MessageAttributes: options.from
          ? {
              "AWS.SNS.SMS.SenderID": {
                DataType: "String",
                StringValue: options.from,
              },
            }
          : undefined,
      });

      const response = await snsClient.send(command);

      logger.info("SMS sent via AWS SNS", {
        messageId: response.MessageId,
        to: options.to,
      });

      return {
        success: true,
        messageId: response.MessageId,
        provider: "aws-sns",
      };
    } catch (error) {
      logger.error("Error sending SMS via AWS SNS:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        provider: "aws-sns",
      };
    }
  }
}

/**
 * Twilio SMS Provider
 * Uses Twilio API for sending SMS
 */
export class TwilioSMSProvider implements SMSProvider {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly defaultFrom?: string;

  constructor(accountSid: string, authToken: string, defaultFrom?: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.defaultFrom = defaultFrom;
  }

  async sendSMS(options: SMSOptions): Promise<NotificationResult> {
    try {
      // Import Twilio SDK dynamically
      const twilio = await import("twilio");

      const client = twilio.default(this.accountSid, this.authToken);

      const message = await client.messages.create({
        body: options.message,
        to: options.to,
        from: options.from || this.defaultFrom,
      });

      logger.info("SMS sent via Twilio", {
        messageId: message.sid,
        to: options.to,
        status: message.status,
      });

      return {
        success: true,
        messageId: message.sid,
        provider: "twilio",
      };
    } catch (error) {
      logger.error("Error sending SMS via Twilio:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        provider: "twilio",
      };
    }
  }
}

/**
 * SMS Service Manager
 * Manages SMS sending using configured provider
 */
export class SMSService {
  private provider: SMSProvider;
  private enabled: boolean;
  private defaultFrom?: string;

  constructor(
    provider: SMSProvider,
    enabled: boolean = true,
    defaultFrom?: string,
  ) {
    this.provider = provider;
    this.enabled = enabled;
    this.defaultFrom = defaultFrom;
  }

  async send(options: SMSOptions): Promise<NotificationResult> {
    if (!this.enabled) {
      logger.warn("SMS service is disabled, skipping SMS send");
      return {
        success: false,
        error: "SMS service is disabled",
      };
    }

    // Apply default from number if not provided
    const smsOptions: SMSOptions = {
      ...options,
      from: options.from || this.defaultFrom,
    };

    return await this.provider.sendSMS(smsOptions);
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
