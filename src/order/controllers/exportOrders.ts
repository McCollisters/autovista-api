import express from "express";
import { Order } from "@/_global/models";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
import ObjectsToCsv from "objects-to-csv";
import { format } from "date-fns";
import { unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

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

    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return next({
        statusCode: 400,
        message: "Order IDs are required.",
      });
    }

    // Find orders
    const orders = await Order.find({
      _id: { $in: orderIds },
    })
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
        id: "TOTAL",
        reg: null,
        company_name: null,
        customer_name: null,
        booked_on: null,
        pickup_date: null,
        agents: null,
        miles: null,
        vehicles: null,
        mccollisters_rate: grandTotalMCRate - grandTotalOversize - grandTotalFuel,
        company_tariff: grandTotalCompanyTariff,
        commission: grandTotalCommission,
        oversize_surcharge: grandTotalOversize,
        fuel_surcharge: grandTotalFuel,
        total_price: grandTotal,
      },
      ...formattedOrders,
    ];

    // Generate CSV
    const csv = new ObjectsToCsv(csvData);
    const filePath = join(tmpdir(), `orders-${Date.now()}.csv`);
    await csv.toDisk(filePath);

    // Send file and delete after download
    res.download(filePath, "orders.csv", (err) => {
      if (err) {
        logger.error("Error downloading CSV file", { error: err });
      }
      // Clean up file
      try {
        unlinkSync(filePath);
      } catch (unlinkErr) {
        logger.error("Error deleting temporary CSV file", { error: unlinkErr });
      }
    });

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

