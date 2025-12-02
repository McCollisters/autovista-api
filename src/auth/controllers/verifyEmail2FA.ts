/**
 * Verify Email 2FA Controller
 *
 * Handles the first step of 2FA authentication:
 * Validates email/password and sends verification code
 */

import express from "express";
import { User } from "@/_global/models";
import { Status } from "@/_global/enums";
import { logger } from "@/core/logger";
import { sendVerificationEmail } from "../services/sendVerificationEmail";

export const verifyEmail2FA = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    let { email, password } = req.body;

    if (!email) {
      logger.error("Please provide an email address.");
      return next({
        statusCode: 400,
        message: "Please provide an email address.",
      });
    }

    if (!password) {
      logger.error("Please provide a password");
      return next({
        statusCode: 400,
        message: "Please provide a password.",
      });
    }

    email = email.toLowerCase();
    const user = await User.findOne({ email });

    if (!user) {
      logger.error("No user found with this email address.", {
        reqBody: req.body.email,
      });
      return next({
        statusCode: 404,
        message: "No user found with this email address.",
      });
    }

    if (user.status === Status.Archived) {
      logger.error("This user is inactive.", { reqBody: req.body.email });
      return next({
        statusCode: 500,
        message: "This user is inactive.",
      });
    }

    // Verify password
    const passwordMatch = await user.comparePassword(password);

    if (!passwordMatch) {
      return next({
        statusCode: 401,
        message: "Incorrect email or password.",
      });
    }

    // Skip verification for mesamoving emails
    if (email.includes("mesamoving")) {
      logger.info(`Skipping verification for mesamoving email: ${email}`);
      res.status(200).json({
        email: user.email,
        skipVerification: true,
      });
      return;
    }

    // Send verification code
    const result = await sendVerificationEmail(email);

    if (result) {
      user.verificationCode = result.code;
      user.verificationCodeSent = result.codeSent;
      user.verificationCodeExpires = result.codeExpires;

      await user.save();
    }

    // In test environment, return the code for testing
    if (process.env.NODE_ENV === "test") {
      res.status(200).json({
        email: user.email,
        code: result.code,
        codeExpires: result.codeExpires,
      });
      return;
    }

    // In production, don't return the code
    res.status(200).json({
      email: user.email,
      codeExpires: result.codeExpires,
    });
  } catch (error) {
    logger.error("Error requesting verification code", {
      error: error instanceof Error ? error.message : error,
      email: req.body?.email,
    });
    return next({
      statusCode: 400,
      message: "Error requesting verification code.",
    });
  }
};
