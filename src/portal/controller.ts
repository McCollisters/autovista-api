import express from "express";
import { Portal } from "./schema";

export const createPortal = async (req: express.Request, res: express.Response): Promise<void> => {
  const portal = await new Portal({ brand: "Ford" }).save()
  res.send(portal);
};

export const updatePortal = async (req: express.Request, res: express.Response): Promise<void> => {
    const savedPortal = await new Portal({ brand: "Ford" }).save()
    res.send(savedPortal);
};

export const getPortal = async (req: express.Request, res: express.Response): Promise<void> => {
    const savedPortal = await new Portal({ brand: "Ford" }).save()
    res.send(savedPortal);
};