import express from "express";
import { Order } from "@/_global/models";
import { saveSDUpdatesToDB } from "@/order/integrations/saveSDUpdatesToDB";

export const getOrder = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { orderId } = req.params;
    let order = await Order.findById(orderId)
      .populate("portalId", "companyName"); // Populate portal to get companyName

    if (!order) {
      return next({ statusCode: 404, message: "Order not found." });
    }

    await saveSDUpdatesToDB(order);

    order = await Order.findById(orderId)
      .populate("portalId", "companyName");

    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
};
