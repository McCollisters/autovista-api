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

    const timestamp = new Date().getTime();
    const userId = user._id instanceof Types.ObjectId 
      ? user._id.toString() 
      : String(user._id);
    const payload = {
      userId,
      portalId: user.portalId?.toString(),
      iat: timestamp,
      role: user.role,
      exp: timestamp + 86400000, // 24 hours
    };

    return jwt.sign(payload, JWT_SECRET);
  } catch (error) {
    const userId = user._id instanceof Types.ObjectId 
      ? user._id.toString() 
      : String(user._id);
    logger.error("Error creating JWT token", {
      error: error instanceof Error ? error.message : error,
      userId,
    });
    throw error;
  }
};
