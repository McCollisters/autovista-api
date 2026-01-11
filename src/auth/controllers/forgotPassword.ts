/**
 * Forgot Password Controller
 *
 * Handles password reset requests:
 * Generates a reset token and sends it via email
 */

import express from "express";
import { User } from "@/_global/models";
import { logger } from "@/core/logger";
import { Status } from "@/_global/enums";
import { createToken } from "@/_global/utils/createToken";
import { getNotificationManager } from "@/notification";

/**
 * POST /forgotpassword
 * Request password reset
 *
 * Expects body: { email: string }
 * Returns: success message
 */
export const forgotPassword = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    let { email } = req.body;

    if (!email) {
      logger.error("No email provided for password reset");
      return next({
        statusCode: 400,
        message: "Please provide an email address.",
      });
    }

    email = email.toLowerCase().trim();
    const user = await User.findOne({ email });

    if (!user) {
      logger.error("No user found with this email address.", {
        email: req.body.email,
      });
      return next({
        statusCode: 404,
        message: "No user found with this email address.",
      });
    }

    // Check if user is archived
    if (user.status === Status.Archived) {
      logger.error("User is archived", { email, userId: user._id });
      return next({
        statusCode: 404,
        message: "No user found with this email address.",
      });
    }

    // Create reset token (using JWT token)
    const token = createToken(user);
    const resetPasswordExpires = new Date(Date.now() + 3600000); // Expires in 1 hour

    // Send password reset email
    const firstName = user.firstName || "User";
    const resetUrl = `https://autovista.mccollisters.com/reset-password/${token}`;
    const html = `
      <p>Hi ${firstName},</p>
      <p>Someone requested a new password for the AutoVista account registered to this email address.</p>
      <p>You can reset your password by clicking <a href="${resetUrl}">this link.</a></p>
      <p>If you did not make this request, please contact us at autologistics@mccollisters.com.</p>
      <p>Thank you!</p>
      <p>The McCollister's Auto Logistics Team</p>
    `;

    const notificationManager = getNotificationManager();
    const result = await notificationManager.sendEmail({
      to: user.email,
      from: "autologistics@mccollisters.com",
      subject: "Your AutoVista Password Reset Link",
      html,
    });

    if (!result.success) {
      logger.error("Failed to send password reset email", {
        email: user.email,
        error: result.error,
      });
      return next({
        statusCode: 500,
        message: "There was an error sending the password reset email.",
      });
    }

    // Update user with reset token and expiration
    user.resetPasswordToken = token;
    user.resetPasswordExpires = resetPasswordExpires;
    await user.save();

    logger.info("Password reset email sent", {
      email: user.email,
      userId: user._id,
    });

    res.status(200).json({ message: "Password reset email sent." });
  } catch (error) {
    logger.error("Error requesting password reset", {
      error: error instanceof Error ? error.message : error,
      email: req.body?.email,
    });
    return next({
      statusCode: 500,
      message: "There was an error requesting a password reset.",
    });
  }
};
