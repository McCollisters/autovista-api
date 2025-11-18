/**
 * Request Track Order Controller
 *
 * This controller handles requests to track an order by sending:
 * 1. Email confirmation to customer
 * 2. Email notification to internal team
 * 3. SMS location request to driver via Captivated API
 */

import express from "express";
import { logger } from "@/core/logger";
import { Order } from "@/_global/models";
import { sendTrackOrderConfirmation } from "../notifications/sendTrackOrderConfirmation";
import { sendTrackOrderNotification } from "../notifications/sendTrackOrderNotification";

interface RequestTrackOrderParams {
  orderId: string;
}

/**
 * Request driver location via SMS and send tracking notifications
 */
export const requestTrackOrder = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { orderId } = req.params as RequestTrackOrderParams;

    const order = await Order.findById(orderId);

    if (!order) {
      return next({
        statusCode: 404,
        message: "Order not found.",
      });
    }

    // Get driver phone from order
    // Note: Adjust field names based on actual schema structure
    const phoneNumber =
      order.driver?.phone || (order as any).driverPhone || null;

    if (!phoneNumber) {
      return next({
        statusCode: 500,
        message: "No driver has been assigned.",
      });
    }

    // Send email notifications (async, don't wait)
    sendTrackOrderConfirmation({ order }).catch((error) => {
      logger.error("Error sending track order confirmation:", error);
    });

    sendTrackOrderNotification({ order }).catch((error) => {
      logger.error("Error sending track order notification:", error);
    });

    // Determine message text based on driver phone type
    // Note: driverPhoneType might be stored elsewhere or need to be added to schema
    const driverPhoneType =
      (order.driver as any)?.phoneType ||
      (order as any).driverPhoneType ||
      "Driver";

    // Get vehicle info
    const firstVehicle =
      order.vehicles && order.vehicles.length > 0 ? order.vehicles[0] : null;

    // Get delivery address
    const deliveryAddress =
      order.destination?.address?.address ||
      order.destination?.address?.addressLine1 ||
      "";
    const deliveryCity = order.destination?.address?.city || "";
    const deliveryState = order.destination?.address?.state || "";

    let messageText: string;

    if (driverPhoneType === "Driver") {
      messageText = `Hello, you are hauling McCollister's ORDER ID ${order.refId}, a ${firstVehicle?.make || ""} ${firstVehicle?.model || ""} being delivered to ${deliveryAddress}, ${deliveryCity}, ${deliveryState}.  Please share your location by clicking the link below so we can see how close you are to destination.  Remember, don't text and drive.  Please be safely stopped before replying to this message.`;
    } else {
      messageText = `Hello, you were dispatched McCollister's ORDER ID ${order.refId}, a ${firstVehicle?.make || ""} ${firstVehicle?.model || ""} being delivered to ${deliveryAddress}, ${deliveryCity}, ${deliveryState}. Please share your location by clicking the link below or text us the current driver's location so we can see how close you are to destination.  Remember, don't text and drive.  Please be safely stopped before replying to this message.`;
    }

    // Encode message text for URL
    const encodedMessageText = encodeURIComponent(messageText);

    // Prepare phone number (remove any formatting, ensure it starts with digits only)
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, "");

    // Captivated API configuration
    const captivatedKey = process.env.CAPTIVATED_API_KEY;

    if (!captivatedKey) {
      logger.error("Captivated API key not configured");
      return next({
        statusCode: 500,
        message: "Location tracking service is not configured.",
      });
    }

    // Build Captivated API URL
    const captivatedUrl = `https://captivated-api.herokuapp.com/api/command/v1/messages?to=tel%3A%2B1${cleanPhoneNumber}&from=tel%3A%2B16094004889&text=${encodedMessageText}&type=location&callback_url=${encodeURIComponent("https://mcc-portal-api.herokuapp.com/captivated/callback")}`;

    try {
      // Send SMS location request via Captivated API
      const response = await fetch(captivatedUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${captivatedKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Captivated API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          orderId: order._id,
        });

        return next({
          statusCode: 500,
          message: "There was an error requesting this driver's location.",
        });
      }

      const captivatedResponse = await response.json();

      logger.info("Track order request sent successfully", {
        orderId: order._id,
        uniqueId: order.refId,
        driverPhone: phoneNumber,
      });

      res.status(200).json({
        order,
        captivated: captivatedResponse,
      });
    } catch (captivatedError) {
      logger.error("Error calling Captivated API:", {
        error:
          captivatedError instanceof Error
            ? captivatedError.message
            : String(captivatedError),
        orderId: order._id,
      });

      return next({
        statusCode: 500,
        message: "There was an error requesting this driver's location.",
      });
    }
  } catch (error) {
    logger.error("Error in requestTrackOrder:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orderId: req.params.orderId,
    });

    next({
      statusCode: 500,
      message: "There was an error requesting this driver's location.",
    });
  }
};
