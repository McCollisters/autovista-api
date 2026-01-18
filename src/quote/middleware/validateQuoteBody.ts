import { Request, Response, NextFunction } from "express";

export const validateQuoteBody = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { origin, destination, vehicles, portalId, portal, userId, user } =
    req.body;
  const resolvedPortal = portal || portalId;
  const resolvedUser = user || userId;

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

  if (!resolvedPortal || typeof resolvedPortal !== "string") {
    return next({
      statusCode: 400,
      message: "portal is required and must be a string",
    });
  }

  if (resolvedUser && typeof resolvedUser !== "string") {
    return next({
      statusCode: 400,
      message: "user must be a string",
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
