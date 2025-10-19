import express from "express";
import { Brand } from "@/_global/models";

export const createBrand = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  const savedBrand = await new Brand({ brand: "Ford" }).save();
  res.send(savedBrand);
};
