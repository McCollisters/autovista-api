import express from "express";
import { Order, SurveyResponse } from "@/_global/models";
import { Types } from "mongoose";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";

/**
 * GET /api/v1/surveys/order/:orderId
 * Get survey responses for a specific order
 */
export const getSurveyOrderResults = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));

    const normalizedOrderId = orderId?.trim() || "";
    const numericMatch = normalizedOrderId.match(/\d+/);
    const orderIdNumber = numericMatch ? parseInt(numericMatch[0], 10) : null;

    let order = null;
    if (Types.ObjectId.isValid(normalizedOrderId)) {
      order = await Order.findById(normalizedOrderId);
    }
    if (!order && orderIdNumber !== null && !Number.isNaN(orderIdNumber)) {
      order = await Order.findOne({ refId: orderIdNumber });
    }

    if (!order) {
      return next({
        statusCode: 404,
        message: "Survey results not found for this order.",
      });
    }

    if (
      !authUser ||
      (authUser.role !== "platform_admin" &&
        authUser.portalId?.toString() !== order.portalId?.toString())
    ) {
      return next({
        statusCode: 403,
        message: "You do not have access to this order's results.",
      });
    }

    const results = await SurveyResponse.find({
      $or: [{ order: order._id }, { orderId: order.refId }],
    })
      .populate("question")
      .sort({ createdAt: -1 });

    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};
