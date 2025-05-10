import express from "express";
import { Order } from "../schema";

export const updateOrder = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.body.refId,
      req.body,
    );
    res.status(200).json(updatedOrder);
  } catch (error) {
    next(error);
  }
};
