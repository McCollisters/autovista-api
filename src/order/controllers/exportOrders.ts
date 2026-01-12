import express from "express";
import { Order } from "@/_global/models";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
import { format } from "date-fns";
import { Types } from "mongoose";

/**
 * POST /orders/export
 * Export orders to CSV
 */
export const exportOrders = async (
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

    // Get filter parameters from request body (same as getOrders query params)
    const {
      portalId,
      selectedPortalId,
      searchText,
      dateStart,
      dateEnd,
      orderTableStatus,
    } = req.body;

    // Build query criteria (same logic as getOrders)
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
        try {
          query.portalId = new Types.ObjectId(finalPortalId as string);
        } catch (error) {
          logger.error("Invalid portalId format", {
            portalId: finalPortalId,
            error: error instanceof Error ? error.message : error,
          });
        }
      }
    }

    // Search text handling
    if (searchText) {
      const searchStr = (searchText as string).toLowerCase();

      if (/^\d+$/.test(searchStr)) {
        query.refId = parseInt(searchStr, 10);
      } else if (/^m-\d+$/i.test(searchStr) || /^u-\d+$/i.test(searchStr)) {
        const numPart = searchStr.replace(/^[mu]-/i, "");
        if (/^\d+$/.test(numPart)) {
          query.refId = parseInt(numPart, 10);
        }
      } else {
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

    // Status filtering (orderTableStatus)
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
          Object.assign(query, statusConditions[0]);
        } else {
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

    // Find all orders matching the query (no pagination)
    const orders = await Order.find(query)
      .populate("portalId")
      .sort({ refId: 1 })
      .lean();

    if (!orders || orders.length === 0) {
      return next({
        statusCode: 404,
        message: "Orders not found.",
      });
    }

    // Initialize grand totals
    let grandTotalMCRate = 0;
    let grandTotalCommission = 0;
    let grandTotalCompanyTariff = 0;
    let grandTotalFuel = 0;
    let grandTotalOversize = 0;
    let grandTotal = 0;

    // Format orders for CSV
    const formattedOrders = orders.map((order: any) => {
      // Format vehicles
      let vehicles = "";
      order.vehicles.forEach((v: any, i: number) => {
        vehicles += `${v.make || ""} ${v.model || ""} ${v.year || ""}`;
        if (v.vin) {
          vehicles += ` (VIN: ${v.vin})`;
        }
        if (v.isInoperable) {
          vehicles += ` - INOP`;
        }
        if (i !== order.vehicles.length - 1) {
          vehicles += "\n";
        }
      });
      vehicles = vehicles.replace(/,/g, " ");

      // Format agents
      let agents = "";
      if (order.agents && order.agents.length > 0) {
        order.agents.forEach((a: any, i: number) => {
          agents += a.email || "";
          if (a.name) {
            agents += ` (${a.name})`;
          }
          if (i !== order.agents.length - 1) {
            agents += "\n";
          }
        });
      }
      agents = agents ? agents.replace(/,/g, " ") : "";

      const companyName = order.portalId?.companyName
        ? order.portalId.companyName.replace(/,/g, " ")
        : "";

      let reg = order.reg ? String(order.reg).replace(/,/g, "") : "";
      reg = reg ? reg.replace(/ , /g, "") : "";

      // Calculate vehicle totals
      let totalOversize = 0;
      let totalFuel = 0;
      let totalCommission = 0;
      let totalCompanyTariff = 0;

      order.vehicles.forEach((v: any) => {
        if (v.pricing?.modifiers) {
          totalOversize += v.pricing.modifiers.oversize || 0;
          totalFuel += v.pricing.modifiers.fuel || 0;
          totalCommission += v.pricing.modifiers.commission || 0;
          totalCompanyTariff += v.pricing.modifiers.companyTariff || 0;
        }
      });

      // Add to grand totals
      grandTotalCommission += totalCommission || 0;
      grandTotalCompanyTariff += totalCompanyTariff || 0;
      grandTotalFuel += totalFuel;
      grandTotalOversize += totalOversize;
      grandTotal += order.totalPricing?.totalWithCompanyTariffAndCommission || 0;
      grandTotalMCRate += order.totalPricing?.total || 0;

      // Format booked date
      const bookedOn = order.bookedAt
        ? format(new Date(order.bookedAt), "MM/dd/yy")
        : "";

      // Format pickup date
      const pickupDate = order.schedule?.pickupSelected
        ? format(new Date(order.schedule.pickupSelected), "MM/dd/yyyy")
        : "";

      return {
        id: order.refId || "",
        reg: reg,
        company_name: companyName,
        customer_name: order.customer?.name?.replace(/,/g, " ") || "",
        booked_on: bookedOn,
        pickup_date: pickupDate,
        agents: agents,
        miles: order.miles || 0,
        vehicles: vehicles,
        mccollisters_rate:
          (order.totalPricing?.total || 0) - totalOversize - totalFuel,
        company_tariff: totalCompanyTariff,
        commission: totalCommission,
        oversize_surcharge: totalOversize,
        fuel_surcharge: totalFuel,
        total_price: order.totalPricing?.totalWithCompanyTariffAndCommission || 0,
      };
    });

    // Add totals row at the beginning
    const csvData = [
      {
        id: null,
        reg: null,
        company_name: null,
        customer_name: null,
        booked_on: null,
        pickup_date: null,
        agents: null,
        miles: null,
        vehicles: "TOTAL",
        mccollisters_rate: grandTotalMCRate - grandTotalOversize - grandTotalFuel,
        company_tariff: grandTotalCompanyTariff,
        commission: grandTotalCommission,
        oversize_surcharge: grandTotalOversize,
        fuel_surcharge: grandTotalFuel,
        total_price: grandTotal,
      },
      ...formattedOrders,
    ];

    // Return JSON data for frontend CSVLink component
    // The frontend will handle the CSV generation and download
    res.status(200).json(csvData);

    logger.info(`User ${authUser.email} exported ${orders.length} orders`);
  } catch (error) {
    logger.error("Error exporting orders", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return next({
      statusCode: 500,
      message: "There was an error exporting orders.",
    });
  }
};

