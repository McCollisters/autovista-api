/**
 * Get User From Token Utility
 *
 * Extracts and validates JWT token from authorization header
 * Returns the user associated with the token
 */

import jwt from "jsonwebtoken";
import { User, IUser } from "@/_global/models";
import { logger } from "@/core/logger";

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || "";

/**
 * Get user from JWT token in authorization header
 * @param authHeader - Authorization header (format: "Bearer <token>" or "jwt <token>")
 * @returns User document or null if invalid
 */
export const getUserFromToken = async (
  authHeader?: string,
): Promise<IUser | null> => {
  try {
    if (!authHeader) {
      return null;
    }

    // Support both "Bearer <token>" and "jwt <token>" formats
    let token: string | null = null;

    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else if (authHeader.startsWith("jwt ")) {
      token = authHeader.slice(4);
    } else {
      // Try to use the header as-is (might be just the token)
      token = authHeader;
    }

    if (!token || !JWT_SECRET) {
      return null;
    }

    // Decode and verify token
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      portalId?: string;
      role?: string;
      iat?: number;
      exp?: number;
    };

    if (!decoded.userId) {
      return null;
    }

    // Check if token is expired
    if (decoded.exp && Date.now() > decoded.exp * 1000) {
      logger.warn("Token expired", { userId: decoded.userId });
      return null;
    }

    // Find user and populate portal
    const user = await User.findById(decoded.userId).populate("portalId");

    if (!user) {
      return null;
    }

    return user;
  } catch (error) {
    logger.error("Error getting user from token", {
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
};

