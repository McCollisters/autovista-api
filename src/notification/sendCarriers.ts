/**
 * Send Carriers Notification
 *
 * This service sends a notification when a carrier signs up
 * Sends carrier sign-up information to internal team
 */

import { logger } from "@/core/logger";
import { getNotificationManager } from "@/notification";

interface SendCarriersParams {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  recipients: Array<{
    email: string;
    name?: string;
  }>;
}

/**
 * Send carrier sign-up notification
 * Returns individual results for each recipient
 */
export async function sendCarriers({
  email,
  firstName,
  lastName,
  company,
  phone,
  recipients,
}: SendCarriersParams): Promise<
  Array<{ recipient: string; success: boolean; error?: string }>
> {
  try {
    if (!recipients || recipients.length === 0) {
      return [
        {
          recipient: "unknown",
          success: false,
          error: "At least one recipient is required.",
        },
      ];
    }

    const senderEmail = "autologistics@mccollisters.com";
    const senderName = "McCollister's AutoLogistics";
    const subject = "Autovista Carrier Sign-Up Request";

    // Build HTML content
    const html = `
      <p><strong>First Name:</strong> ${firstName || "Not provided"}</p>
      <p><strong>Last Name:</strong> ${lastName || "Not provided"}</p>
      <p><strong>Company:</strong> ${company || "Not provided"}</p>
      <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
      <p><strong>Email:</strong> ${email || "Not provided"}</p>
    `;

    // Send email using notification manager
    const notificationManager = getNotificationManager();

    // Send to all recipients and return individual results
    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        const result = await notificationManager.sendEmail({
          to: recipient.email,
          subject,
          html,
          from: senderEmail,
          fromName: senderName,
        });

        return {
          recipient: recipient.email,
          success: result.success ?? false,
          error: result.error,
        };
      }),
    );

    const finalResults = results.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : {
            recipient: "unknown",
            success: false,
            error: String(result.reason),
          },
    );

    const successCount = finalResults.filter((r) => r.success).length;

    logger.info("Carrier sign-up notification sent", {
      recipientCount: recipients.length,
      successCount,
      carrierEmail: email,
    });

    return finalResults;
  } catch (error) {
    logger.error("Error sending carrier sign-up notification:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      carrierEmail: email,
    });
    return recipients.map((r) => ({
      recipient: r.email,
      success: false,
      error: "Failed to send carrier sign-up notification.",
    }));
  }
}
