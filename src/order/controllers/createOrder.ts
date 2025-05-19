import express from "express";
import { Order } from "../schema";
import { Quote } from "../../quote/schema";
import { Status } from "../../_global/enums";
import { updateVehiclesWithQuote } from "../services/updateVehiclesWithQuote";
import { sendOrderToSD } from "../services/sendOrderToSD";

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
    const quote = await Quote.findByIdAndUpdate(quoteId, {
      status: Status.Booked,
    });

    if (!quote) {
      return next({ statusCode: 404, message: "Quote not found." });
    }

    const orderVehicles = await updateVehiclesWithQuote({
      vehicles,
      quote,
    });

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
    };

    const createdOrder = await new Order(formattedOrder).save();

    // If "Billing":
    // Else COD
    const superDispatchResponse = await sendOrderToSD(createdOrder);

    if (superDispatchResponse.status === "success") {
      const orderWithSuperDispatch = await Order.findByIdAndUpdate(
        createdOrder._id,
        {
          tms: {
            guid: superDispatchResponse.data.object.guid,
            status: superDispatchResponse.data.object.status,
            createdAt: superDispatchResponse.data.object.created_at,
            updatedAt: superDispatchResponse.data.object.changed_at,
          },
        },
        { new: true },
      );

      res.status(201).json(orderWithSuperDispatch);
    } else {
      res.status(201).json(createdOrder);
    }
  } catch (error) {
    next(error);
  }
};
