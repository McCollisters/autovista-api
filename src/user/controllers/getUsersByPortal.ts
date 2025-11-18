import express from "express";
import { User } from "@/_global/models";
import { Status } from "../../_global/enums";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";

export const getUsersByPortal = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { portalId } = req.params;
    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));

    if (!authUser) {
      return next({
        statusCode: 401,
        message: "Unauthorized",
      });
    }

    // Check authorization: MCAdmin can access any portal, others can only access their own portal
    if (
      authUser.role !== "MCAdmin" &&
      authUser.portalId?.toString() !== portalId
    ) {
      return next({
        statusCode: 401,
        message: "Unauthorized",
      });
    }

    const users = await User.find({
      portalId,
      status: { $ne: Status.Archived },
    }).populate("portalId");

    res.status(200).json(users);
  } catch (error) {
    logger.error("Error fetching users by portal", {
      error: error instanceof Error ? error.message : error,
      portalId: req.params.portalId,
    });
    return next({
      statusCode: 500,
      message: "There was an error fetching users.",
    });
  }
};

