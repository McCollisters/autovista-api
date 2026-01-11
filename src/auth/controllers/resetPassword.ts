/**
 * Reset Password Controller
 *
 * Handles password reset:
 * Verifies reset token and updates user password
 */

import express from "express";
import jwt from "jsonwebtoken";
import { User } from "@/_global/models";
import { logger } from "@/core/logger";

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || "";

/**
 * POST /resetpassword
 * Reset user password
 *
 * Expects body: { password: string }
 * Expects header: Authorization: JWT <token>
 * Returns: success message
 */
export const resetPassword = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { password } = req.body;

    if (!password) {
      logger.error("No password provided for password reset");
      return next({
        statusCode: 400,
        message: "Please provide a password.",
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      logger.error("No authorization header provided for password reset");
      return next({
        statusCode: 400,
        message: "Please provide a valid reset token.",
      });
    }

    // Extract token from header (support "JWT ", "jwt ", "Bearer " formats)
    let token: string | null = null;
    if (authHeader.startsWith("JWT ")) {
      token = authHeader.slice(4);
    } else if (authHeader.startsWith("jwt ")) {
      token = authHeader.slice(4);
    } else if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else {
      token = authHeader; // Use as-is
    }

    if (!token || !JWT_SECRET) {
      logger.error("Invalid token format or JWT_SECRET not configured");
      return next({
        statusCode: 400,
        message: "Invalid reset token.",
      });
    }

    // Decode and verify token
    let decoded: { userId: string; exp?: number };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        exp?: number;
      };
    } catch (error) {
      logger.error("Invalid or expired reset token", {
        error: error instanceof Error ? error.message : error,
      });
      return next({
        statusCode: 401,
        message: "Invalid or expired reset token.",
      });
    }

    if (!decoded.userId) {
      logger.error("Token missing userId");
      return next({
        statusCode: 401,
        message: "Invalid reset token.",
      });
    }

    // Find user by ID
    const user = await User.findById(decoded.userId);

    if (!user) {
      logger.error("User not found for password reset", {
        userId: decoded.userId,
      });
      return next({
        statusCode: 404,
        message: "User not found.",
      });
    }

    // Verify the token matches the stored reset token
    if (user.resetPasswordToken && user.resetPasswordToken !== token) {
      logger.error("Reset token does not match stored token", {
        email: user.email,
        userId: user._id,
      });
      return next({
        statusCode: 401,
        message: "Invalid reset token.",
      });
    }

    // Check if token has expired (check both JWT expiration and stored expiration)
    if (decoded.exp && Date.now() > decoded.exp * 1000) {
      logger.error("Reset token has expired (JWT expiration)", {
        email: user.email,
        userId: user._id,
      });
      return next({
        statusCode: 401,
        message: "Reset token has expired. Please request a new password reset.",
      });
    }

    if (
      user.resetPasswordExpires &&
      new Date() > new Date(user.resetPasswordExpires)
    ) {
      logger.error("Reset token has expired (stored expiration)", {
        email: user.email,
        userId: user._id,
      });
      return next({
        statusCode: 401,
        message: "Reset token has expired. Please request a new password reset.",
      });
    }

    // Update password
    user.password = password;
    // Clear reset token and expiration
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    logger.info("Password reset successful", {
      email: user.email,
      userId: user._id,
    });

    res.status(200).json({ message: "Password has been reset." });
  } catch (error) {
    logger.error("Error resetting password", {
      error: error instanceof Error ? error.message : error,
    });
    return next({
      statusCode: 500,
      message: "There was an error resetting your password.",
    });
  }
};
