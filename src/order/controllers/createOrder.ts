import express from "express";
import { Order, Quote } from "@/_global/models";
import { Status } from "../../_global/enums";
import { updateVehiclesWithQuote } from "../services/updateVehiclesWithQuote";
import { sendOrderToSD } from "../services/sendOrderToSD";
import { formatOrderTotalPricing } from "../services/formatOrderTotalPricing";

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
    paymentType,
  } = req.body;

  try {
    const quote = await Quote.findById(quoteId);

    if (!quote) {
      return next({ statusCode: 404, message: "Quote not found." });
    }

    const orderExists = await Order.findOne({ refId: quote.refId });

    if (orderExists) {
      return next({ statusCode: 409, message: "Order already exists." });
    }

    const orderVehicles = await updateVehiclesWithQuote({
      vehicles,
      quote,
      transportType,
      serviceLevel: schedule.serviceLevel,
    });

    const orderTotalPricing = await formatOrderTotalPricing({
      quote,
      transportType,
      serviceLevel: schedule.serviceLevel,
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
      totalPricing: orderTotalPricing,
      schedule,
      paymentType,
    };

    const createdOrder = await new Order(formattedOrder).save();

    if (!createdOrder) {
      return next({ statusCode: 500, message: "Error creating order." });
    }

    await Quote.findByIdAndUpdate(quoteId, { status: Status.Booked });

    if (paymentType.toLowerCase() === "billing") {
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
    } else {
      res.status(201).json(createdOrder);
    }

    // Send relevant notifications
  } catch (error) {
    next(error);
  }
};
