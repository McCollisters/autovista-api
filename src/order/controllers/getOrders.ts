import express from "express";
import { Order } from "@/_global/models";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
import { Status } from "@/_global/enums";
import { Types } from "mongoose";

/**
 * GET /api/v1/orders
 * Get orders with filtering, sorting, and pagination
 */
export const getOrders = async (
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
      selectedPortalId,
      searchText,
      dateStart,
      dateEnd,
      cod,
      paid,
      moveType,
      orderTableStatus,
    } = req.query;

    // Parse pagination
    const skipNum = skip ? parseInt(skip as string, 10) : 0;
    const limitNum =
      cod === "true" ? 10000 : limit ? parseInt(limit as string, 10) : 100;

    // Handle sorting
    let sortField = "refId";
    if (sortby) {
      switch (sortby as string) {
        case "created":
          sortField = "createdAt";
          break;
        case "transitTime":
          sortField = "transitTime.0";
          break;
        case "pickupScheduledAt":
          sortField = "schedule.pickupSelected";
          break;
        case "deliveryScheduledAt":
          sortField = "schedule.deliveryEstimated.0";
          break;
        case "actualPickupDate":
          sortField = "schedule.pickupCompleted";
          break;
        case "actualDeliveryDate":
          sortField = "schedule.deliveryCompleted";
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
    // platform_admin and platform_user can see all orders (no restriction)

    // Portal filtering
    let finalPortalId = portalId || selectedPortalId;
    if (finalPortalId && finalPortalId !== "all") {
      if (
        authUser.role === "platform_admin" ||
        authUser.role === "platform_user"
      ) {
        // Mongoose can handle both string and ObjectId for ObjectId fields
        // Convert string portalId to ObjectId for consistent query matching
        try {
          query.portalId = new Types.ObjectId(finalPortalId as string);
        } catch (error) {
          logger.error("Invalid portalId format", {
            portalId: finalPortalId,
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

      // Handle unique ID format (m-123 or u-123)
      if (/^m-\d+$/i.test(searchStr) || /^u-\d+$/i.test(searchStr)) {
        // Handle unique ID format (refId is stored as number, not string)
        const numPart = searchStr.replace(/^[mu]-/i, "");
        if (/^\d+$/.test(numPart)) {
          query.refId = parseInt(numPart, 10);
        }
      } else if (/^\d+$/.test(searchStr)) {
        // Pure number - search by refId (order ID)
        query.refId = parseInt(searchStr, 10);
      } else {
        // Text search - search in various fields
        const regexPattern = new RegExp(searchStr, "i");
        query.$or = [
          { "origin.address.address": { $regex: regexPattern } },
          { "origin.address.city": { $regex: regexPattern } },
          { "origin.address.state": { $regex: regexPattern } },
          { "origin.address.zip": { $regex: regexPattern } },
          { "destination.address.address": { $regex: regexPattern } },
          { "destination.address.city": { $regex: regexPattern } },
          { "destination.address.state": { $regex: regexPattern } },
          { "destination.address.zip": { $regex: regexPattern } },
          { "customer.name": { $regex: regexPattern } },
          { "customer.email": { $regex: regexPattern } },
          { "customer.companyName": { $regex: regexPattern } },
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

    // Note: Removed default status filter - return all orders
    // The old API filtered by status "Booked" or "Pending" when no search text,
    // but since "Pending" doesn't exist in Status enum and we want to see all orders,
    // we're not filtering by status by default

    // Date filtering
    if (dateStart || dateEnd) {
      query["schedule.pickupSelected"] = {};
      if (dateStart) {
        const startDate = new Date(dateStart as string);
        startDate.setUTCHours(0, 0, 0, 0);
        query["schedule.pickupSelected"].$gte = startDate;
      }
      if (dateEnd) {
        const endDate = new Date(dateEnd as string);
        endDate.setUTCHours(23, 59, 59, 999);
        query["schedule.pickupSelected"].$lte = endDate;
      }
    }

    // COD filtering
    if (cod === "true") {
      query.paymentType = "cod"; // PaymentType.Cod enum value
    }

    // Paid filtering
    if (paid !== undefined && paid !== null) {
      query.hasPaid = paid === "true";
    }

    // Move type filtering
    if (moveType) {
      const moveTypes = Array.isArray(moveType) ? moveType : [moveType];
      query.transportType = { $in: moveTypes };
    }

    // Status filtering (orderTableStatus)
    // Map display values to database query conditions:
    // "New" = status in ["booked", "active"]
    // "Picked Up" = schedule.pickupCompleted exists AND schedule.deliveryCompleted does NOT exist
    // "Delivered" = status === "complete" AND schedule.deliveryCompleted exists
    if (orderTableStatus) {
      const statusFilters = Array.isArray(orderTableStatus)
        ? orderTableStatus
        : [orderTableStatus];

      const statusConditions: any[] = [];

      statusFilters.forEach((status) => {
        if (status === "New") {
          statusConditions.push({
            status: { $in: ["booked", "active"] },
          });
        } else if (status === "Picked Up") {
          statusConditions.push({
            "schedule.pickupCompleted": { $exists: true, $ne: null },
            $or: [
              { "schedule.deliveryCompleted": { $exists: false } },
              { "schedule.deliveryCompleted": null },
            ],
          });
        } else if (status === "Delivered") {
          statusConditions.push({
            status: "complete",
            "schedule.deliveryCompleted": { $exists: true, $ne: null },
          });
        }
      });

      if (statusConditions.length > 0) {
        if (statusConditions.length === 1) {
          // Merge single condition into query (will AND with existing conditions)
          Object.assign(query, statusConditions[0]);
        } else {
          // Multiple status conditions - use $or
          // If query already has $or from searchText, wrap both in $and
          if (query.$or) {
            const existingOr = query.$or;
            delete query.$or;
            query.$and = [{ $or: existingOr }, { $or: statusConditions }];
          } else {
            query.$or = statusConditions;
          }
        }
      }
    }

    // Exclude null values when sorting by pickup/delivery completed dates
    // Only add the condition if it's not already set (to avoid conflicts with status filters)
    if (sortField === "schedule.pickupCompleted" && !query["schedule.pickupCompleted"]) {
      query["schedule.pickupCompleted"] = { $exists: true, $ne: null };
    } else if (sortField === "schedule.deliveryCompleted" && !query["schedule.deliveryCompleted"]) {
      query["schedule.deliveryCompleted"] = { $exists: true, $ne: null };
    }

    // Debug logging
    logger.info("Getting orders with query", {
      query: JSON.stringify(query),
      queryPortalId: query.portalId?.toString(),
      userRole: authUser.role,
      portalIdParam: portalId,
      selectedPortalIdParam: selectedPortalId,
      skip: skipNum,
      limit: limitNum,
      sortField,
      sortOrder,
    });

    // Get count and orders
    const count = await Order.countDocuments(query);
    const sortObj: any = {};
    sortObj[sortField] = sortOrder as 1 | -1;
    const orders = await Order.find(query)
      .populate("portalId", "companyName") // Populate portal to get companyName
      .populate("userId", "firstName lastName") // Populate user to get booking agent name
      .limit(limitNum)
      .skip(skipNum)
      .sort(sortObj)
      .lean();

    logger.info("Orders retrieved", {
      count,
      returned: orders.length,
      userRole: authUser.role,
      portalId: query.portalId,
    });

    res.status(200).json({
      orders,
      orderCount: count,
    });
  } catch (error) {
    logger.error("Error getting orders", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return next({
      statusCode: 500,
      message: "There was an error getting orders.",
    });
  }
};
