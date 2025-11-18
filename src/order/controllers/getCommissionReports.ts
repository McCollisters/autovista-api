/**
 * Get Commission Reports Controller
 *
 * Returns commission reports for a user by year, broken down by month and quarter
 */

import express from "express";
import { Order, User } from "@/_global/models";
import { logger } from "@/core/logger";
import { DateTime } from "luxon";

interface MonthlyResult {
  month: string;
  ordersCount: number;
  commission: number;
  user: {
    _id: string;
    name: string;
  };
}

interface QuarterlyResult {
  quarter: string;
  ordersCount: number;
  commission: number;
  user: {
    _id: string;
    name: string;
  };
}

/**
 * Get monthly commission breakdown for a user in a given year
 */
async function getMonthlyOrders(
  year: number,
  user: any,
): Promise<MonthlyResult[]> {
  const results: MonthlyResult[] = [];

  for (let month = 0; month < 12; month++) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 1);

    const orders = await Order.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      userId: user._id,
    });

    let monthlyCommission = 0;

    orders.forEach((order) => {
      order.vehicles.forEach((vehicle: any) => {
        // Commission is stored in vehicle.pricing.modifiers.commission
        monthlyCommission += vehicle.pricing?.modifiers?.commission || 0;
      });
    });

    const monthName = DateTime.fromObject({ year, month: month + 1 }).toFormat(
      "MMMM",
    );

    results.push({
      month: monthName,
      ordersCount: orders.length,
      commission: monthlyCommission,
      user: {
        _id: user._id.toString(),
        name:
          `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
      },
    });
  }

  return results;
}

/**
 * Get quarterly commission breakdown for a user in a given year
 */
async function getQuarterlyOrders(
  year: number,
  user: any,
): Promise<QuarterlyResult[]> {
  const results: QuarterlyResult[] = [];
  const quarters = [
    { name: "Q1", startMonth: 0, endMonth: 3 },
    { name: "Q2", startMonth: 3, endMonth: 6 },
    { name: "Q3", startMonth: 6, endMonth: 9 },
    { name: "Q4", startMonth: 9, endMonth: 12 },
  ];

  for (const quarter of quarters) {
    const startDate = new Date(Date.UTC(year, quarter.startMonth, 1));
    const endDate = new Date(Date.UTC(year, quarter.endMonth, 1));

    const orders = await Order.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      userId: user._id,
    });

    let quarterlyCommission = 0;

    orders.forEach((order) => {
      order.vehicles.forEach((vehicle: any) => {
        // Commission is stored in vehicle.pricing.modifiers.commission
        quarterlyCommission += vehicle.pricing?.modifiers?.commission || 0;
      });
    });

    results.push({
      quarter: quarter.name,
      ordersCount: orders.length,
      commission: quarterlyCommission,
      user: {
        _id: user._id.toString(),
        name:
          `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
      },
    });
  }

  return results;
}

export const getCommissionReports = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { year, userId } = req.body;

    if (!year) {
      return next({
        statusCode: 400,
        message: "Year is required.",
      });
    }

    if (!userId) {
      return next({
        statusCode: 400,
        message: "UserId is required.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      logger.error("User not found for commission reports", { userId });
      return next({
        statusCode: 404,
        message: "User not found.",
      });
    }

    const monthlyResults = await getMonthlyOrders(year, user);
    const quarterlyResults = await getQuarterlyOrders(year, user);

    const allResults = [...monthlyResults, ...quarterlyResults];

    logger.info("Commission reports generated", {
      userId,
      year,
      monthlyCount: monthlyResults.length,
      quarterlyCount: quarterlyResults.length,
    });

    res.status(200).json(allResults);
  } catch (error) {
    logger.error("Error getting commission reports", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body,
    });
    return next({
      statusCode: 500,
      message: "There was an error getting commission reports.",
    });
  }
};
