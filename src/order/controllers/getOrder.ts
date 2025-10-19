import express from "express";
import { Order } from "@/_global/models";

export const getOrder = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return next({ statusCode: 404, message: "Order not found." });
    }

    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
};
