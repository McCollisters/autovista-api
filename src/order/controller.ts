import express from "express";
import { Order } from "./schema";

export const createOrder = async (req: express.Request, res: express.Response): Promise<void> => {
  const savedOrder = await new Order({ brand: "Ford" }).save()
  res.send(savedOrder);
};