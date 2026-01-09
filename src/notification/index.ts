/**
 * Notification Service Factory
 *
 * Creates and configures notification services based on environment configuration
 */

import { logger } from "@/core/logger";
import { EmailService, SendGridEmailProvider } from "./email";
import { SMSService, AWSSNSProvider, TwilioSMSProvider } from "./sms";
import { NotificationManager } from "./manager";
import { NotificationConfig } from "./types";

/**
 * Initialize email service based on configuration
 */
function createEmailService(config: NotificationConfig["email"]): EmailService {
  if (!config.enabled) {
    logger.info("Email service is disabled");
    // Use SendGrid provider as placeholder when disabled (matches default)
    const sendGridApiKey = process.env.SENDGRID_API_KEY || "disabled";
    return new EmailService(
      new SendGridEmailProvider(sendGridApiKey, ""),
      false,
    );
  }

  // Only SendGrid is supported
  if (config.provider !== "sendgrid") {
    throw new Error(
      `Unsupported email provider: ${config.provider}. Only "sendgrid" is supported.`,
    );
  }

  const sendGridApiKey = process.env.SENDGRID_API_KEY || "";

  if (!sendGridApiKey) {
    throw new Error(
      "SendGrid API key is required. Please set SENDGRID_API_KEY environment variable.",
    );
  }

  const provider = new SendGridEmailProvider(
    sendGridApiKey,
    config.fromAddress || "autologistics@mccollisters.com",
    config.fromName || "McCollister's AutoLogistics",
    config.replyTo || "autologistics@mccollisters.com",
  );

  return new EmailService(
    provider,
    config.enabled,
    config.fromAddress || "autologistics@mccollisters.com",
    config.replyTo || "autologistics@mccollisters.com",
  );
}

/**
 * Initialize SMS service based on configuration
 */
function createSMSService(config: NotificationConfig["sms"]): SMSService {
  if (!config.enabled) {
    logger.info("SMS service is disabled");
    // Use Twilio provider as placeholder when disabled (matches default)
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || "disabled";
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || "disabled";
    return new SMSService(
      new TwilioSMSProvider(twilioAccountSid, twilioAuthToken),
      false,
    );
  }

  let provider: AWSSNSProvider | TwilioSMSProvider;

  switch (config.provider) {
    case "twilio": // DEFAULT PROVIDER
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || "";
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || "";

      // If Twilio credentials are not provided, disable SMS service instead of throwing error
      if (!twilioAccountSid || !twilioAuthToken) {
        logger.warn(
          "SMS is enabled but Twilio credentials are missing. SMS service will be disabled.",
        );
        // Create a disabled SMS service with placeholder credentials
        return new SMSService(
          new TwilioSMSProvider("disabled", "disabled"),
          false, // Disabled
        );
      }

      provider = new TwilioSMSProvider(
        twilioAccountSid,
        twilioAuthToken,
        config.fromNumber || process.env.TWILIO_FROM_NUMBER,
      );
      break;

    case "aws-sns":
      // AWS SNS doesn't require credentials if using IAM role
      provider = new AWSSNSProvider(config.fromNumber);
      break;

    default:
      throw new Error(`Unsupported SMS provider: ${config.provider}`);
  }

  return new SMSService(provider, config.enabled, config.fromNumber);
}

/**
 * Create notification manager with configured services
 */
export function createNotificationManager(
  config?: NotificationConfig,
): NotificationManager {
  const notificationConfig: NotificationConfig = config || {
    email: {
      provider: "sendgrid",
      enabled: process.env.EMAIL_ENABLED !== "false",
      fromAddress:
        process.env.EMAIL_FROM_ADDRESS || "autologistics@mccollisters.com",
      fromName: process.env.EMAIL_FROM_NAME || "McCollister's AutoLogistics",
      replyTo: process.env.EMAIL_REPLY_TO || "autologistics@mccollisters.com",
    },
    sms: {
      provider: (process.env.SMS_PROVIDER as "aws-sns" | "twilio") || "twilio",
      enabled: process.env.SMS_ENABLED !== "false",
      fromNumber: process.env.SMS_FROM_NUMBER,
    },
  };

  try {
    const emailService = createEmailService(notificationConfig.email);
    const smsService = createSMSService(notificationConfig.sms);

    logger.info("Notification manager initialized", {
      email: {
        enabled: emailService.isEnabled(),
        provider: notificationConfig.email.provider,
      },
      sms: {
        enabled: smsService.isEnabled(),
        provider: notificationConfig.sms.provider,
      },
    });

    return new NotificationManager(emailService, smsService);
  } catch (error) {
    logger.error("Failed to initialize notification manager:", error);
    throw error;
  }
}

// Export singleton instance (lazy initialization)
let notificationManagerInstance: NotificationManager | null = null;

export function getNotificationManager(): NotificationManager {
  if (!notificationManagerInstance) {
    notificationManagerInstance = createNotificationManager();
  }
  return notificationManagerInstance;
}
