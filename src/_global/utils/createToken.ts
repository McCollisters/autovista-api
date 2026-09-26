/**
 * JWT Token Creation Utility
 *
 * Creates JWT tokens for user authentication
 */

import jwt from "jsonwebtoken";
import { logger } from "@/core/logger";
import { IUser } from "@/user/schema";
import { Types } from "mongoose";

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || "";
const TOKEN_TTL_SECONDS = 86400; // 24 hours

if (!JWT_SECRET) {
  logger.warn(
    "JWT_SECRET not set in environment variables. Token creation may fail.",
  );
}

/**
 * Create a JWT token for a user
 * @param user - The user object to create a token for
 * @returns JWT token string
 */
export const createToken = (user: IUser): string => {
  try {
    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const userId =
      user._id instanceof Types.ObjectId
        ? user._id.toString()
        : String(user._id);
    const payload = {
      userId,
      portalId: user.portalId?.toString(),
      iat: nowSec,
      role: user.role,
      exp: nowSec + TOKEN_TTL_SECONDS,
    };

    return jwt.sign(payload, JWT_SECRET);
  } catch (error) {
    const userId =
      user._id instanceof Types.ObjectId
        ? user._id.toString()
        : String(user._id);
    logger.error("Error creating JWT token", {
      error: error instanceof Error ? error.message : error,
      userId,
    });
    throw error;
  }
};
