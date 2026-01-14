import express from "express";
import { ModifierSet } from "@/_global/models";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";

/**
 * GET /settings/global-modifier-sets
 * Get global modifier sets (where isGlobal: true)
 */
export const getGlobalModifierSets = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));

    if (!authUser) {
      return next({
        statusCode: 401,
        message: "Unauthorized",
      });
    }

    // Only platform admins can access global modifier sets
    if (
      authUser.role !== "platform_admin" &&
      authUser.role !== "platform_user"
    ) {
      return next({
        statusCode: 403,
        message:
          "Forbidden - Only platform admins can access global modifier sets",
      });
    }

    const globalModifierSets = await ModifierSet.find({
      isGlobal: true,
    }).lean();

    logger.info("getGlobalModifierSets - retrieved global modifier sets", {
      userRole: authUser.role,
      userEmail: authUser.email,
      count: globalModifierSets.length,
    });

    res.status(200).json(globalModifierSets);
  } catch (error) {
    logger.error("Error getting global modifier sets", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return next({
      statusCode: 500,
      message: "There was an error getting global modifier sets.",
    });
  }
};
