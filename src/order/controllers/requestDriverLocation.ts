import express from "express";
import axios from "axios";
import { Order } from "@/_global/models";
import { logger } from "@/core/logger";
import { sendTrackOrderConfirmation } from "../notifications/sendTrackOrderConfirmation";
import { sendTrackOrderNotification } from "../notifications/sendTrackOrderNotification";

const CAPTIVATED_KEY = process.env.CAPTIVATED_KEY || "";
const CAPTIVATED_CALLBACK_URL =
  process.env.CAPTIVATED_CALLBACK_URL ||
  "https://mcc-portal-api.herokuapp.com/captivated/callback";

/**
 * POST /api/v1/order/:orderId/location
 * Request driver location via SMS
 * 
 * Sends SMS to driver requesting location sharing via Captivated API
 */
export const requestDriverLocation = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
      return next({
        statusCode: 404,
        message: "Order not found.",
      });
    }

    // Get driver phone number
    const phoneNumber = order.driver?.phone;

    if (!phoneNumber) {
      return next({
        statusCode: 500,
        message: "No driver has been assigned.",
      });
    }

    // Send confirmation emails
    try {
      await sendTrackOrderConfirmation({ order });
      await sendTrackOrderNotification({ order });
    } catch (emailError) {
      logger.warn("Error sending track order emails", {
        error: emailError instanceof Error ? emailError.message : emailError,
        orderId: order._id,
      });
      // Continue even if email fails
    }

    // Build message text
    const firstVehicle = order.vehicles?.[0];
    const vehicleInfo = firstVehicle
      ? `${firstVehicle.make} ${firstVehicle.model}`
      : "vehicle";
    const deliveryAddress = order.destination?.address?.address || "";
    const deliveryCity = order.destination?.address?.city || "";
    const deliveryState = order.destination?.address?.state || "";

    let messageText: string;
    // Default to "Driver" since type property doesn't exist on IDriver interface
    const driverType = "Driver";
    
    if (driverType === "Driver") {
      messageText = `Hello, you are hauling McCollister's ORDER ID ${order.refId}, a ${vehicleInfo} being delivered to ${deliveryAddress}, ${deliveryCity}, ${deliveryState}.  Please share your location by clicking the link below so we can see how close you are to destination.  Remember, don't text and drive.  Please be safely stopped before replying to this message.`;
    } else {
      messageText = `Hello, you were dispatched McCollister's ORDER ID ${order.refId}, a ${vehicleInfo} being delivered to ${deliveryAddress}, ${deliveryCity}, ${deliveryState}. Please share your location by clicking the link below or text us the current driver's location so we can see how close you are to destination.  Remember, don't text and drive.  Please be safely stopped before replying to this message.`;
    }

    // Clean phone number (remove non-digits)
    const cleanPhone = phoneNumber.replace(/\D/g, "");

    // Encode message
    const encodedMessageText = encodeURIComponent(messageText);

    // Call Captivated API
    const captivatedUrl = `https://captivated-api.herokuapp.com/api/command/v1/messages?to=tel%3A%2B1${cleanPhone}&from=tel%3A%2B16094004889&text=${encodedMessageText}&type=location&callback_url=${encodeURIComponent(CAPTIVATED_CALLBACK_URL)}`;

    try {
      const response = await axios.post(
        captivatedUrl,
        {},
        {
          headers: {
            Authorization: `Bearer ${CAPTIVATED_KEY}`,
          },
        },
      );

      logger.info("Driver location request sent", {
        orderId: order._id,
        refId: order.refId,
        phoneNumber: cleanPhone,
      });

      res.status(200).json({
        order,
        captivated: response.data,
      });
    } catch (apiError) {
      logger.error("Error calling Captivated API", {
        error: apiError instanceof Error ? apiError.message : apiError,
        orderId: order._id,
      });
      return next({
        statusCode: 500,
        message: "There was an error requesting this driver's location.",
      });
    }
  } catch (error) {
    logger.error("Error requesting driver location", {
      error: error instanceof Error ? error.message : error,
      orderId: req.params.orderId,
    });
    next({
      statusCode: 500,
      message: "There was an error requesting this driver's location.",
    });
  }
};

