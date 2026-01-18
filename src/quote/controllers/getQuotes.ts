import express from "express";
import { Quote } from "@/_global/models";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
import { getPortalRoleSets, isPlatformRole } from "@/_global/utils/portalRoles";
import { Types } from "mongoose";
import { Status } from "@/_global/enums";

/**
 * GET /api/v1/quotes
 * Get quotes with filtering, sorting, and pagination
 */
export const getQuotes = async (
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

    // Get query parameters
    const {
      skip,
      limit,
      sortby,
      sortorder,
      portalId,
      searchText,
      dateStart,
      dateEnd,
      transportType,
    } = req.query;

    // Parse pagination
    const skipNum = skip ? parseInt(skip as string, 10) : 0;
    const limitNum = limit ? parseInt(limit as string, 10) : 50;

    // Handle sorting
    let sortField = "refId";
    if (sortby) {
      switch (sortby as string) {
        case "createdAt":
          sortField = "createdAt";
          break;
        case "uniqueId":
        case "refId":
          sortField = "refId";
          break;
        default:
          sortField = sortby as string;
      }
    }
    const sortOrder = sortorder ? parseInt(sortorder as string, 10) : -1;

    // Build query criteria
    const query: any = {};

    const { adminPortalIds, userPortalIds } = getPortalRoleSets(authUser);
    const hasPlatformAccess = isPlatformRole(authUser.role);

    if (!hasPlatformAccess) {
      if (portalId && portalId !== "all") {
        const portalIdString = String(portalId);
        if (adminPortalIds.includes(portalIdString)) {
          query.portal = portalIdString;
        } else if (userPortalIds.includes(portalIdString)) {
          query.portal = portalIdString;
          query.user = authUser._id;
        } else {
          return next({
            statusCode: 403,
            message: "You do not have access to this portal's quotes.",
          });
        }
      } else {
        const portalFilters: any[] = [];
        if (adminPortalIds.length > 0) {
          portalFilters.push({ portal: { $in: adminPortalIds } });
        }
        if (userPortalIds.length > 0) {
          portalFilters.push({
            portal: { $in: userPortalIds },
            user: authUser._id,
          });
        }
        if (portalFilters.length === 0) {
          return next({
            statusCode: 403,
            message: "You do not have access to any portals.",
          });
        }
        if (portalFilters.length === 1) {
          Object.assign(query, portalFilters[0]);
        } else {
          query.$or = portalFilters;
        }
      }
    } else if (portalId && portalId !== "all") {
      try {
        query.portal = new Types.ObjectId(portalId as string);
      } catch (error) {
        logger.error("Invalid portalId format", {
          portalId: portalId,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    // Search text handling
    if (searchText) {
      const searchStr = (searchText as string).toLowerCase();

      // Handle unique ID format (q-123 or refId number)
      if (/^q-\d+$/i.test(searchStr)) {
        // Handle unique ID format (refId is stored as number, not string)
        const numPart = searchStr.replace(/^q-/i, "");
        if (/^\d+$/.test(numPart)) {
          query.refId = parseInt(numPart, 10);
        }
      } else if (/^\d+$/.test(searchStr)) {
        // Pure number - search by refId (quote ID)
        query.refId = parseInt(searchStr, 10);
      } else {
        // Text search - search in various fields
        const regexPattern = new RegExp(searchStr, "i");
        query.$or = [
          { "origin.userInput": { $regex: regexPattern } },
          { "origin.validated": { $regex: regexPattern } },
          { "origin.state": { $regex: regexPattern } },
          { "destination.userInput": { $regex: regexPattern } },
          { "destination.validated": { $regex: regexPattern } },
          { "destination.state": { $regex: regexPattern } },
          { "customer.name": { $regex: regexPattern } },
          { "customer.email": { $regex: regexPattern } },
          {
            vehicles: {
              $elemMatch: {
                $or: [
                  { make: { $regex: regexPattern } },
                  { model: { $regex: regexPattern } },
                ],
              },
            },
          },
        ];
      }
    }

    // Date filtering (filter by createdAt)
    if (dateStart || dateEnd) {
      query.createdAt = {};
      if (dateStart) {
        const startDate = new Date(dateStart as string);
        startDate.setUTCHours(0, 0, 0, 0);
        query.createdAt.$gte = startDate;
      }
      if (dateEnd) {
        const endDate = new Date(dateEnd as string);
        endDate.setUTCHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    // Transport type filtering
    if (transportType) {
      const transportTypes = Array.isArray(transportType)
        ? transportType
        : [transportType];
      query.transportType = { $in: transportTypes };
    }

    // Exclude archived quotes
    // Always exclude quotes with status "archived" or "Archived"
    // Handle null/undefined status by including them (they're not archived)
    const statusExclusion = {
      $or: [
        { status: { $exists: false } },
        { status: null },
        { status: { $nin: [Status.Archived, "Archived"] } },
      ],
    };

    if (query.$or) {
      // If $or already exists (from search), combine both $or conditions using $and
      // MongoDB will AND the $and array with other top-level fields
      query.$and = [{ $or: query.$or }, statusExclusion];
      delete query.$or;
    } else {
      // No existing $or, add status exclusion directly
      // MongoDB will AND this with other top-level conditions
      query.$or = statusExclusion.$or;
    }

    // Debug logging
    logger.info("Getting quotes with query", {
      query: JSON.stringify(query, null, 2),
      queryPortalId: query.portal?.toString(),
      userRole: authUser.role,
      portalIdParam: portalId,
      skip: skipNum,
      limit: limitNum,
      sortField,
      sortOrder,
      hasStatusExclusion: !!(query.$or || query.$and),
    });

    // Get count and quotes
    const count = await Quote.countDocuments(query);
    const sortObj: any = {};
    sortObj[sortField] = sortOrder as 1 | -1;
    const quotes = await Quote.find(query)
      .populate("portal", "companyName") // Populate portal to get companyName
      .populate("user", "firstName lastName") // Populate user to get booking agent name
      .limit(limitNum)
      .skip(skipNum)
      .sort(sortObj)
      .lean();

    const quotesWithPortalId = quotes.map((quote: any) => {
      const updates: Record<string, any> = {};
      if (quote.portal && !quote.portalId) {
        updates.portalId = quote.portal;
      }
      if (quote.user && !quote.userId) {
        updates.userId = quote.user;
      }
      return Object.keys(updates).length ? { ...quote, ...updates } : quote;
    });

    logger.info("Quotes retrieved", {
      count,
      returned: quotes.length,
      userRole: authUser.role,
      portalId: query.portal,
    });

    res.status(200).json({
      quotes: quotesWithPortalId,
      quoteCount: count,
    });
  } catch (error) {
    logger.error("Error getting quotes", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return next({
      statusCode: 500,
      message: "There was an error getting quotes.",
    });
  }
};
