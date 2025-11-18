/**
 * Notification Manager
 *
 * Unified service for managing email and SMS notifications
 */

import { logger } from "@/core/logger";
import { EmailService } from "./email";
import { SMSService } from "./sms";
import {
  EmailOptions,
  SMSOptions,
  NotificationResult,
  NotificationMetadata,
} from "./types";

export interface NotificationOptions {
  email?: EmailOptions;
  sms?: SMSOptions;
  metadata?: NotificationMetadata;
}

export interface NotificationResponse {
  email?: NotificationResult;
  sms?: NotificationResult;
  metadata?: NotificationMetadata;
}

/**
 * Notification Manager
 * Provides a unified interface for sending notifications via email and/or SMS
 */
export class NotificationManager {
  private emailService: EmailService;
  private smsService: SMSService;

  constructor(emailService: EmailService, smsService: SMSService) {
    this.emailService = emailService;
    this.smsService = smsService;
  }

  /**
   * Send notifications (email and/or SMS)
   */
  async send(options: NotificationOptions): Promise<NotificationResponse> {
    const response: NotificationResponse = {
      metadata: options.metadata,
    };

    // Send email if provided and service is enabled
    if (options.email && this.emailService.isEnabled()) {
      try {
        response.email = await this.emailService.send(options.email);

        if (response.email.success) {
          logger.info("Email notification sent successfully", {
            metadata: options.metadata,
            messageId: response.email.messageId,
          });
        } else {
          logger.error("Failed to send email notification", {
            metadata: options.metadata,
            error: response.email.error,
          });
        }
      } catch (error) {
        logger.error("Error sending email notification:", error);
        response.email = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // Send SMS if provided and service is enabled
    if (options.sms && this.smsService.isEnabled()) {
      try {
        response.sms = await this.smsService.send(options.sms);

        if (response.sms.success) {
          logger.info("SMS notification sent successfully", {
            metadata: options.metadata,
            messageId: response.sms.messageId,
          });
        } else {
          logger.error("Failed to send SMS notification", {
            metadata: options.metadata,
            error: response.sms.error,
          });
        }
      } catch (error) {
        logger.error("Error sending SMS notification:", error);
        response.sms = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return response;
  }

  /**
   * Send email only
   */
  async sendEmail(options: EmailOptions): Promise<NotificationResult> {
    return await this.emailService.send(options);
  }

  /**
   * Send SMS only
   */
  async sendSMS(options: SMSOptions): Promise<NotificationResult> {
    return await this.smsService.send(options);
  }

  /**
   * Check if email service is enabled
   */
  isEmailEnabled(): boolean {
    return this.emailService.isEnabled();
  }

  /**
   * Check if SMS service is enabled
   */
  isSMSEnabled(): boolean {
    return this.smsService.isEnabled();
  }
}
