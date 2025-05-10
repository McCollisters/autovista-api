import express from "express";
import { Order } from "../schema";

export const getOrders = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    res.status(200).json(await Order.find({}));
  } catch (error) {
    next(error);
  }
};
