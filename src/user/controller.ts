import express from "express";
import { User } from "./schema";

export const createUser = async (req: express.Request, res: express.Response): Promise<void> => {
  const savedUser = await new User({ brand: "Ford" }).save()
  res.send(savedUser);
};