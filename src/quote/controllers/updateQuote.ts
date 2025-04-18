import express from "express";
import { Quote } from "../schema";

export const updateQuote = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { status, refId, userId, customer } = req.body;

    const updatedQuote = await Quote.findByIdAndUpdate(refId, {
      ...(status !== undefined && { status }),
      ...(userId !== undefined && { userId }),
      ...(customer !== undefined && { customer }),
    });

    res.status(200).send(updatedQuote);
  } catch (error) {
    next(error);
  }
};
