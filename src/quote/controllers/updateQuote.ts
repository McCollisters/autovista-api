import express from "express";
import { Quote } from "@/_global/models";
import { Status } from "@/_global/enums";

export const updateQuote = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const payload = { ...req.body } as Record<string, any>;
    if (payload.status) {
      const statusValue = String(payload.status).trim().toLowerCase();
      if (statusValue === "saved") {
        payload.status = Status.Active;
      } else if (statusValue === "archived") {
        payload.status = Status.Archived;
      } else if (statusValue === "booked") {
        payload.status = Status.Booked;
      } else if (statusValue === "expired") {
        payload.status = Status.Expired;
      } else if (statusValue === "active") {
        payload.status = Status.Active;
      }
    }

    const updatedQuote = await Quote.findByIdAndUpdate(
      req.params.quoteId,
      payload,
      {
        new: true,
      },
    );

    res.status(200).json(updatedQuote);
  } catch (error) {
    next(error);
  }
};
