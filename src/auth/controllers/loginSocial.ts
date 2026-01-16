import express from "express";
import { OAuth2Client } from "google-auth-library";
import { User } from "@/_global/models";
import { createToken } from "@/_global/utils/createToken";
import { getPortalRoles } from "@/_global/utils/portalRoles";
import { logger } from "@/core/logger";
import { Status } from "@/_global/enums";

/**
 * Verify Google ID token
 */
async function verifyGoogleToken(clientId: string, jwtToken: string) {
  const client = new OAuth2Client(clientId);

  const ticket = await client.verifyIdToken({
    idToken: jwtToken,
    audience: clientId,
  });

  const payload = ticket.getPayload();
  return payload;
}

/**
 * POST /login-social
 * Social login using Google OAuth2
 *
 * Expects body: { clientId: string, token: string }
 * Returns: { token: string, role: string, userId: string, portalId: string }
 */
export const loginSocial = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { clientId, token } = req.body;

    if (!token || !clientId) {
      logger.error("No token or clientId provided for social login");
      return next({
        statusCode: 400,
        message: "No token.",
      });
    }

    // Verify Google token
    let userDetails;
    try {
      userDetails = await verifyGoogleToken(clientId, token);
    } catch (error) {
      logger.error("Error verifying Google token", {
        error: error instanceof Error ? error.message : error,
      });
      return next({
        statusCode: 401,
        message: "Invalid token.",
      });
    }

    if (!userDetails?.email) {
      logger.error("No email found in Google token");
      return next({
        statusCode: 404,
        message: "User not found.",
      });
    }

    const email = userDetails.email.toLowerCase().trim();

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      logger.error("No user found with email from Google token", { email });
      return next({
        statusCode: 404,
        message: "No user found with this email address.",
      });
    }

    // Check if user is archived
    if (user.status === Status.Archived) {
      logger.error("User is archived", { email, userId: user._id });
      return next({
        statusCode: 500,
        message: "This user is inactive.",
      });
    }

    // Create JWT token
    const newToken = createToken(user);

    // TODO: Log login event if Log model exists
    // await Log.create({
    //   user,
    //   templateName: "Login",
    // });

    logger.info("Social login successful", {
      email,
      userId: user._id,
      role: user.role,
    });

    const portalRoles = getPortalRoles(user).map((entry) => ({
      portalId:
        typeof entry.portalId === "string"
          ? entry.portalId
          : entry.portalId?.toString(),
      role: entry.role,
    }));

    res.status(200).json({
      token: newToken,
      role: user.role,
      userId: user._id.toString(),
      portalId: user.portalId?.toString() || null,
      portalRoles,
    });
  } catch (error) {
    logger.error("Error in loginSocial", {
      error: error instanceof Error ? error.message : error,
    });
    next({
      statusCode: 500,
      message: "There was an error logging in.",
    });
  }
};
