import express from "express";
import { Order } from "../schema";
import { Quote } from "../../quote/schema";
import { Status } from "../../_global/enums";
import { updateVehiclesWithQuote } from "../services/updateVehiclesWithQuote";

export const createOrder = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  const {
    quoteId,
    transportType,
    origin,
    destination,
    vehicles,
    customer,
    schedule,
    reg,
  } = req.body;

  try {
    const quote = await Quote.findById(quoteId);
    if (!quote) {
      return next({ statusCode: 404, message: "Quote not found." });
    }

    const orderVehicles = await updateVehiclesWithQuote({
      vehicles,
      quote,
    });

    const tmsMock = {
      guid: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      status: "new",
      updatedAt: "2025-04-19T00:00:00.000Z",
      createdAt: "2025-04-19T00:00:00.000Z",
    };

    const formattedOrder = {
      refId: quote.refId,
      reg,
      status: Status.Active,
      portalId: quote.portalId,
      userId: quote.userId,
      quoteId: quoteId,
      transportType: transportType.toLowerCase(),
      origin,
      destination,
      miles: quote.miles,
      customer,
      vehicles: orderVehicles,
      totalPricing: quote.totalPricing,
      schedule,
      tms: tmsMock,
    };

    const createdOrder = await new Order(formattedOrder).save();
    res.status(200).send(createdOrder);
  } catch (error) {
    next(error);
  }
};
