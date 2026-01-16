import express from "express";
import { Order } from "@/_global/models";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
import { getPortalRoleSets, isPlatformRole } from "@/_global/utils/portalRoles";

/**
 * GET /orders/analytics
 * Get order analytics (grand totals, commission, etc.)
 */
export const getOrdersAnalytics = async (
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

    const {
      portalId,
      start,
      end,
      searchText,
      selectedPortalId,
    } = req.query;

    // Build query
    const query: any = {};

    const { adminPortalIds, userPortalIds } = getPortalRoleSets(authUser);
    const hasPlatformAccess = isPlatformRole(authUser.role);
    const finalPortalId = portalId || selectedPortalId;

    if (!hasPlatformAccess) {
      if (finalPortalId && finalPortalId !== "all") {
        const portalIdString = String(finalPortalId);
        if (adminPortalIds.includes(portalIdString)) {
          query.portalId = portalIdString;
        } else if (userPortalIds.includes(portalIdString)) {
          query.portalId = portalIdString;
          query.userId = authUser._id;
        } else {
          return next({
            statusCode: 403,
            message: "You do not have access to this portal's orders.",
          });
        }
      } else {
        const portalFilters: any[] = [];
        if (adminPortalIds.length > 0) {
          portalFilters.push({ portalId: { $in: adminPortalIds } });
        }
        if (userPortalIds.length > 0) {
          portalFilters.push({
            portalId: { $in: userPortalIds },
            userId: authUser._id,
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
    } else if (finalPortalId && finalPortalId !== "all") {
      query.portalId = finalPortalId;
    }

    // Date filtering
    if (start || end) {
      query.createdAt = {};
      if (start) {
        query.createdAt.$gte = new Date(start as string);
      }
      if (end) {
        query.createdAt.$lte = new Date(end as string);
      }
    }

    // Search text (if needed, can search by refId, customer name, etc.)
    if (searchText) {
      query.$or = [
        { refId: { $regex: searchText, $options: "i" } },
        { "customer.name": { $regex: searchText, $options: "i" } },
        { "customer.email": { $regex: searchText, $options: "i" } },
      ];
    }

    // Selected portal is already handled in role-based filtering above

    // Exclude COD orders for analytics
    query.paymentType = { $ne: "COD" };

    // Get orders (limit to 50000 for analytics)
    const orders = await Order.find(query)
      .limit(50000)
      .lean();

    // Calculate totals
    let grandTotalMCRate = 0;
    let grandTotalCommission = 0;
    let grandTotalCompanyTariff = 0;
    let grandTotal = 0;
    let orderCount = 0;

    orders.forEach((order: any) => {
      orderCount += 1;

      // Calculate vehicle totals
      let totalCommission = 0;
      let totalCompanyTariff = 0;

      if (order.vehicles) {
        order.vehicles.forEach((v: any) => {
          if (v.pricing?.modifiers) {
            totalCommission += v.pricing.modifiers.commission || 0;
            totalCompanyTariff += v.pricing.modifiers.companyTariff || 0;
          }
        });
      }

      grandTotalCommission += totalCommission || 0;
      grandTotalCompanyTariff += totalCompanyTariff || 0;
      grandTotal += order.totalPricing?.totalWithCompanyTariffAndCommission || 0;
      grandTotalMCRate += order.totalPricing?.total || 0;
    });

    res.status(200).json({
      mccollisters_rate: grandTotalMCRate,
      company_tariff: grandTotalCompanyTariff,
      commission: grandTotalCommission,
      total_price: grandTotal,
      orderCount: orderCount,
    });
  } catch (error) {
    logger.error("Error getting order analytics", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return next({
      statusCode: 500,
      message: "There was an error getting order analytics.",
    });
  }
};

