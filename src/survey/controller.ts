import express from "express";
import { Order, Portal, SurveyResponse } from "@/_global/models";

export const createSurvey = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const {
      id,
      communications,
      communicationsDetail,
      driver,
      driverDetail,
      recommend,
      recommendDetail,
      additionalFeedback,
    } = req.body || {};

    let order = null;
    let portal = null;
    if (id) {
      order = await Order.findById(id);
      if (order?.portalId) {
        portal = await Portal.findById(order.portalId);
      }
    }

    const portalName = portal?.companyName || "Unknown";
    const orderRefId = order?.refId || "Unknown";
    const customerEmail =
      order?.customer?.email ||
      (order?.customer as any)?.customerEmail ||
      "Unknown";

    await SurveyResponse.create({
      portal: portal?._id || order?.portalId,
      portalName,
      order: order?._id,
      orderId: orderRefId,
      question: "64f5165b9d6e44ae540090d3",
      email: customerEmail,
      rating: communications,
      explanation: communicationsDetail,
    });

    await SurveyResponse.create({
      portal: portal?._id || order?.portalId,
      portalName,
      order: order?._id,
      orderId: orderRefId,
      question: "64f5165b9d6e44ae540090d4",
      email: customerEmail,
      rating: communications,
      explanation: communicationsDetail,
    });

    await SurveyResponse.create({
      portal: portal?._id || order?.portalId,
      portalName,
      order: order?._id,
      orderId: orderRefId,
      question: "64f5165b9d6e44ae540090d3",
      email: customerEmail,
      rating: driver,
      explanation: driverDetail,
    });

    await SurveyResponse.create({
      portal: portal?._id || order?.portalId,
      portalName,
      order: order?._id,
      orderId: orderRefId,
      question: "64f5165b9d6e44ae540090d5",
      email: customerEmail,
      rating: recommend,
      explanation: recommendDetail,
    });

    await SurveyResponse.create({
      portal: portal?._id || order?.portalId,
      portalName,
      order: order?._id,
      orderId: orderRefId,
      question: "64f5165b9d6e44ae540090d6",
      email: customerEmail,
      explanation: additionalFeedback,
    });

    if (order?._id) {
      await Order.findByIdAndUpdate(order._id, {
        "notifications.survey.surveyCompleted": true,
      });
    }

    res.status(200).send("Survey Completed");

  } catch (error) {
    next(error);
  }
};
