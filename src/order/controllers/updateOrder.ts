import express from "express";
import { Order } from "@/_global/models";

export const updateOrder = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.orderId,
      req.body,
      { new: true },
    );
    res.status(200).json(updatedOrder);
  } catch (error) {
    next(error);
  }
};
