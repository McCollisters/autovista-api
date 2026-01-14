import express from "express";
import { Quote } from "@/_global/models";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
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

    // Role-based filtering
    if (authUser.role === "portal_admin") {
      query.portalId = authUser.portalId;
    } else if (authUser.role === "portal_user") {
      query.userId = authUser._id;
      query.portalId = authUser.portalId;
    }
    // platform_admin and platform_user can see all quotes (no restriction)

    // Portal filtering
    if (portalId && portalId !== "all") {
      if (
        authUser.role === "platform_admin" ||
        authUser.role === "platform_user"
      ) {
        // Mongoose can handle both string and ObjectId for ObjectId fields
        // Convert string portalId to ObjectId for consistent query matching
        try {
          query.portalId = new Types.ObjectId(portalId as string);
        } catch (error) {
          logger.error("Invalid portalId format", {
            portalId: portalId,
            error: error instanceof Error ? error.message : error,
          });
          // If portalId is invalid, skip filtering (might show wrong results, but won't crash)
        }
      }
      // For non-platform roles, portalId is already set above
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
      queryPortalId: query.portalId?.toString(),
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
      .populate("portalId", "companyName") // Populate portal to get companyName
      .populate("userId", "firstName lastName") // Populate user to get booking agent name
      .limit(limitNum)
      .skip(skipNum)
      .sort(sortObj)
      .lean();

    logger.info("Quotes retrieved", {
      count,
      returned: quotes.length,
      userRole: authUser.role,
      portalId: query.portalId,
    });

    res.status(200).json({
      quotes,
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
