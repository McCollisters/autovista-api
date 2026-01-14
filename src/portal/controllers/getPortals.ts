import express from "express";
import { Portal, ModifierSet } from "@/_global/models";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";

export const getPortals = async (
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

    // Only platform admins and platform users can see all portals
    // Other roles should only see their own portal (handled by getUserPortal)
    // Note: Frontend already redirects non-platform admins, but we check here for API security
    if (authUser.role !== "platform_admin" && authUser.role !== "platform_user") {
      logger.warn("getPortals - unauthorized access attempt", {
        userRole: authUser.role,
        userEmail: authUser.email,
      });
      return next({
        statusCode: 403,
        message: "Forbidden - Only platform admins can view all portals",
      });
    }

    // Get portals
    const portals = await Portal.find({}).lean();
    
    // Get all modifierSets for these portals
    const portalIds = portals.map((p) => p._id);
    const modifierSets = await ModifierSet.find({
      portalId: { $in: portalIds },
    })
      .select("portalId companyTariff companyTariffEnclosedFee")
      .lean();
    
    // Create a map of portalId to modifierSet for quick lookup
    const modifierSetMap = new Map();
    modifierSets.forEach((ms) => {
      if (ms.portalId) {
        modifierSetMap.set(ms.portalId.toString(), ms);
      }
    });
    
    // Attach modifierSet to each portal
    const portalsWithModifierSets = portals.map((portal) => {
      const modifierSet = modifierSetMap.get(portal._id.toString());
      return {
        ...portal,
        modifierSet: modifierSet || null,
      };
    });
    
    logger.info("getPortals - returning portals", {
      count: portalsWithModifierSets.length,
      userRole: authUser.role,
      userEmail: authUser.email,
    });
    res.status(200).json(portalsWithModifierSets);
  } catch (error) {
    logger.error("getPortals - error", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    next(error);
  }
};
