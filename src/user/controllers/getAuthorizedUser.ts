import express from "express";
import { User } from "@/_global/models";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";

export const getAuthorizedUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    logger.info("getAuthorizedUser called", { path: req.path, url: req.url });
    // Try to get user from request (if middleware sets it) or from token
    const authHeader = req.headers.authorization;
    const user = (req as any).user ?? (await getUserFromToken(authHeader));

    if (!user) {
      return next({
        statusCode: 401,
        message: "Unauthorized",
      });
    }

    res.status(200).json(user);
  } catch (error) {
    logger.error("Error fetching authorized user", {
      error: error instanceof Error ? error.message : error,
    });
    return next({
      statusCode: 500,
      message: "There was an error fetching this user's data.",
    });
  }
};

