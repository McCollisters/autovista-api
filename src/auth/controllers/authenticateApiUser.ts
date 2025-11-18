import express from "express";
import { User } from "@/_global/models";
import { logger } from "@/core/logger";
import { Status } from "@/_global/enums";

/**
 * GET /public/auth
 * Authenticate API user using Basic Auth
 *
 * Expects Authorization header in format: "Basic <base64(email:password)>"
 * Returns success message if credentials are valid
 */
export const authenticateApiUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    if (!req.headers.authorization) {
      res.status(400).json({ error: "Please provide user credentials." });
      return;
    }

    // Extract base64 encoded credentials
    const authParts = req.headers.authorization.split(" ");
    if (authParts.length !== 2 || authParts[0] !== "Basic") {
      res.status(400).json({
        error: "Invalid authorization format. Expected: Basic <base64>",
      });
      return;
    }

    const encodedCredentials = authParts[1];

    // Decode base64
    const decoded = Buffer.from(encodedCredentials, "base64").toString("utf-8");
    const [email, password] = decoded.split(":");

    if (!email) {
      res.status(400).json({ error: "Please provide an email address." });
      return;
    }

    if (!password) {
      res.status(400).json({ error: "Please provide a password." });
      return;
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      res
        .status(404)
        .json({ error: "No users found with this email address." });
      return;
    }

    // Check if user is archived
    if (user.status === Status.Archived) {
      res
        .status(404)
        .json({ error: "No users found with this email address." });
      return;
    }

    // Verify password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      res.status(401).json({ error: "Incorrect email or password." });
      return;
    }

    // Success
    res.status(200).json({ message: "Authorization successful." });
  } catch (error) {
    logger.error("Error in authenticateApiUser", {
      error: error instanceof Error ? error.message : error,
      reqBody: req.body,
    });
    next({
      statusCode: 500,
      message: "There was an error authorizing this request.",
    });
  }
};
