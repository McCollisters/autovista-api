/**
 * Login Email 2FA Controller
 *
 * Handles the second step of 2FA authentication:
 * Validates verification code and returns JWT token
 */

import express from "express";
import { User } from "@/_global/models";
import { logger } from "@/core/logger";
import { createToken } from "@/_global/utils/createToken";
import { getPortalRoles } from "@/_global/utils/portalRoles";

export const loginEmail2FA = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    let { email, code } = req.body;

    if (!email) {
      logger.error("Please provide an email address.");
      return next({
        statusCode: 400,
        message: "Please provide an email address.",
      });
    }

    email = email.toLowerCase();
    const user = await User.findOne({ email });

    if (!user) {
      logger.error("No user found with this email address.");
      return next({
        statusCode: 404,
        message: "No user found with this email address.",
      });
    }

    // Skip verification for mesamoving emails
    if (email.includes("mesamoving")) {
      logger.info(`Skipping code verification for mesamoving email: ${email}`);
      // Clear any existing verification codes
      user.verificationCode = undefined;
      user.verificationCodeExpires = undefined;
      user.verificationCodeSent = undefined;
      await user.save();
    } else {
      // Normal verification flow for non-mesamoving emails
      if (!code) {
        logger.error("Please enter a verification code.");
        return next({
          statusCode: 400,
          message: "Please enter a verification code.",
        });
      }

      if (!user.verificationCode || !user.verificationCodeExpires) {
        logger.error("Verification code not found or missing expiration", {
          email,
          hasCode: !!user.verificationCode,
          hasExpiration: !!user.verificationCodeExpires,
        });
        return next({
          statusCode: 401,
          message:
            "This verification code has expired. Please request a new code.",
        });
      }

      // Handle both Date objects and string dates from MongoDB
      const expirationTime = user.verificationCodeExpires instanceof Date
        ? user.verificationCodeExpires.getTime()
        : new Date(user.verificationCodeExpires).getTime();
      
      const now = Date.now();
      const timeRemaining = expirationTime - now;

      logger.debug("Verifying code", {
        email,
        codeProvided: code,
        codeStored: user.verificationCode,
        expirationTime: new Date(expirationTime).toISOString(),
        currentTime: new Date(now).toISOString(),
        timeRemainingMs: timeRemaining,
        timeRemainingMinutes: Math.floor(timeRemaining / 60000),
        isExpired: now > expirationTime,
      });

      if (code !== user.verificationCode) {
        logger.error("Incorrect verification code", {
          email,
          codeProvided: code,
          codeStored: user.verificationCode,
        });
        return next({
          statusCode: 401,
          message: "Incorrect verification code.",
        });
      }

      if (now > expirationTime) {
        logger.error("Verification code expired", {
          email,
          expirationTime: new Date(expirationTime).toISOString(),
          currentTime: new Date(now).toISOString(),
          timeRemainingMs: timeRemaining,
        });
        return next({
          statusCode: 401,
          message:
            "This verification code has expired. Please request a new code.",
        });
      }

      // Clear verification code after successful verification
      user.verificationCode = undefined;
      user.verificationCodeExpires = undefined;
      user.verificationCodeSent = undefined;

      await user.save();
    }

    // Create JWT token
    const token = createToken(user);

    // Log successful login
    const userId = String((user as { _id: unknown })._id);
    logger.info("User logged in successfully with 2FA", {
      userId,
      email: user.email,
    });

    const portalRoles = getPortalRoles(user).map((entry) => ({
      portalId:
        typeof entry.portalId === "string"
          ? entry.portalId
          : entry.portalId?.toString(),
      role: entry.role,
    }));

    res.status(200).json({
      token,
      role: user.role,
      userId,
      portalId: user.portalId?.toString() || null,
      portalRoles,
    });
  } catch (error) {
    logger.error("Error logging in with 2FA", {
      error: error instanceof Error ? error.message : error,
      email: req.body?.email,
    });
    return next({
      statusCode: 400,
      message: "There was an error logging in.",
    });
  }
};
