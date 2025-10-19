import express from "express";
import { Order } from "@/_global/models";

export const deleteOrder = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const deletedOrder = await Order.findByIdAndDelete(req.params.orderId);

    if (!deletedOrder) {
      return next({ statusCode: 404, message: "Order not found." });
    }

    res.status(200).json({ orderId: deletedOrder._id });
  } catch (error) {
    next(error);
  }
};
