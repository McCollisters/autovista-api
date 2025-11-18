/**
 * Notification Types and Interfaces
 *
 * This file contains all type definitions for the notification system
 */

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  path?: string;
}

export interface SMSOptions {
  to: string;
  message: string;
  from?: string;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

export interface EmailProvider {
  sendEmail(options: EmailOptions): Promise<NotificationResult>;
}

export interface SMSProvider {
  sendSMS(options: SMSOptions): Promise<NotificationResult>;
}

export interface NotificationConfig {
  email: {
    provider: "sendgrid";
    enabled: boolean;
    fromAddress?: string;
    fromName?: string;
    replyTo?: string;
  };
  sms: {
    provider: "aws-sns" | "twilio";
    enabled: boolean;
    fromNumber?: string;
  };
}

export interface NotificationMetadata {
  type: "email" | "sms";
  channel: string; // e.g., "paymentRequest", "pickupReminder"
  orderId?: string;
  quoteId?: string;
  userId?: string;
  portalId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
}
