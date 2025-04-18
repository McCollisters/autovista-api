import { Request, Response, NextFunction } from "express";

export const validateQuoteBody = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { origin, destination, vehicles, portalId } = req.body;

  if (!origin || typeof origin !== "string") {
    return next(new Error("Origin is required and must be a string"));
  }

  if (!destination || typeof destination !== "string") {
    return next(new Error("Destination is required and must be a string"));
  }

  if (!portalId || typeof portalId !== "string") {
    return next(new Error("portalId is required and must be a string"));
  }

  if (!Array.isArray(vehicles) || vehicles.length === 0) {
    return next(new Error("Vehicles must be a non-empty array"));
  }

  for (const [i, v] of vehicles.entries()) {
    if (!v.make || !v.model) {
      return next(new Error(`Vehicle at index ${i} must have make and model`));
    }
  }

  next();
};
