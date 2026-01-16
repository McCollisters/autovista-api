import { Request, Response, NextFunction } from "express";

export const validateQuoteBody = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { origin, destination, vehicles, portalId, userId } = req.body;

  if (!origin || typeof origin !== "string") {
    return next({
      statusCode: 400,
      message: "Origin is required and must be a string",
    });
  }

  if (!destination || typeof destination !== "string") {
    return next({
      statusCode: 400,
      message: "Destination is required and must be a string",
    });
  }

  if (!portalId || typeof portalId !== "string") {
    return next({
      statusCode: 400,
      message: "portalId is required and must be a string",
    });
  }

  if (userId && typeof userId !== "string") {
    return next({
      statusCode: 400,
      message: "userId must be a string",
    });
  }

  if (!Array.isArray(vehicles) || vehicles.length === 0) {
    return next({
      statusCode: 400,
      message: "Vehicles must be a non-empty array",
    });
  }

  for (const [i, v] of vehicles.entries()) {
    if (!v.make || !v.model) {
      return next({
        statusCode: 400,
        message: `Vehicle at index ${i} must have make and model`,
      });
    }
  }

  next();
};
