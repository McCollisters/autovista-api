import express from "express";
import { Brand } from "./schema";

export const createBrand = async (req: express.Request, res: express.Response): Promise<void> => {
    const savedBrand = await new Brand({ brand: "Ford" }).save()
    res.send(savedBrand);
  };
  