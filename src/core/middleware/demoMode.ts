import express from "express";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
import { Role } from "@/user/schema";
import { logger } from "@/core/logger";

/**
 * Enables Demo Mode for platform admins only when X-Demo-Mode: 1 is sent.
 * Sets req.demoMode = true. Ignored for all other roles.
 */
export const demoModeMiddleware = async (
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    (req as any).demoMode = false;

    const headerVal = String(
      req.headers["x-demo-mode"] || req.headers["X-Demo-Mode"] || "",
    )
      .trim()
      .toLowerCase();

    if (headerVal !== "1" && headerVal !== "true") {
      return next();
    }

    const authHeader = req.headers.authorization;
    const authUser =
      (req as any).user ?? (await getUserFromToken(authHeader));

    if (!authUser || authUser.role !== Role.PlatformAdmin) {
      return next();
    }

    (req as any).user = authUser;
    (req as any).demoMode = true;
    next();
  } catch (error) {
    logger.warn("demoModeMiddleware error; continuing without demo mode", {
      error: error instanceof Error ? error.message : error,
    });
    (req as any).demoMode = false;
    next();
  }
};
