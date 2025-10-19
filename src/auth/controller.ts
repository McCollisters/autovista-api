import express from "express";
import { User } from "@/_global/models";

export const createBrand = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  res.status(200);
};
