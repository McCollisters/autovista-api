/**
 * Webhook Handlers
 *
 * This file contains Super Dispatch webhook handlers for order lifecycle events.
 * These handlers process real webhook events from Super Dispatch.
 */

import { logger } from "@/core/logger";
import { Order, Carrier } from "@/_global/models";
import { Status } from "@/_global/enums";
import {
  ISuperDispatchOrderCancelledPayload,
  ISuperDispatchOrderDeliveredPayload,
  ISuperDispatchOrderInvoicedPayload,
  ISuperDispatchOrderModifiedPayload,
  ISuperDispatchOrderModifiedDetailedPayload,
  ISuperDispatchOrderPickedUpPayload,
  ISuperDispatchOrderRemovedPayload,
  ISuperDispatchVehicleModifiedPayload,
  ICarrierAcceptedPayload,
  ICarrierAcceptedByShipperPayload,
  ICarrierCanceledPayload,
  IOfferSentPayload,
  IWebhookResponse,
} from "./types";

// Super Dispatch webhook handlers
export const handleSuperDispatchOrderCancelled = async (
  payload: ISuperDispatchOrderCancelledPayload,
  headers: Record<string, string>,
): Promise<IWebhookResponse> => {
  try {
    logger.info("Processing Super Dispatch order cancelled", {
      orderGuid: payload.order_guid,
    });

    // Find the order using the TMS GUID (Super Dispatch integration)
    const order = await Order.findOne({ "tms.guid": payload.order_guid });

    if (!order) {
      logger.warn("Order not found for Super Dispatch cancellation", {
        orderGuid: payload.order_guid,
      });

      return {
        success: false,
        message: "Order not found in system",
        processedAt: new Date().toISOString(),
      };
    }

    // Update order status to archived (cancelled)
    order.status = Status.Archived;
    order.tms.status = "order_canceled";
    order.tms.updatedAt = new Date();

    // Add uniqueIdNum field (like old API)
    // order.uniqueIdNum = parseInt(order.uniqueId);

    await order.save();

    logger.info("Order cancelled successfully", {
      orderId: order._id,
      refId: order.refId,
      tmsGuid: payload.order_guid,
    });

    return {
      success: true,
      message: "Order cancelled successfully",
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error processing Super Dispatch order cancelled", {
      orderGuid: payload.order_guid,
      error: error instanceof Error ? error.message : error,
    });

    throw error;
  }
};

export const handleSuperDispatchOrderDelivered = async (
  payload: ISuperDispatchOrderDeliveredPayload,
  headers: Record<string, string>,
): Promise<IWebhookResponse> => {
  try {
    logger.info("Processing Super Dispatch order delivered", {
      orderGuid: payload.order_guid,
    });

    // Send update to Miles accounting software
    try {
      const milesResponse = await fetch(
        "https://api.mccollisters.milesapp.com/api/v1/superdispatch/orderdelivered",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!milesResponse.ok) {
        logger.warn("Failed to send order update to Miles", {
          orderGuid: payload.order_guid,
          status: milesResponse.status,
          statusText: milesResponse.statusText,
        });
      } else {
        logger.info("Successfully sent order update to Miles", {
          orderGuid: payload.order_guid,
        });
      }
    } catch (error) {
      logger.error("Error posting order update to Miles", {
        orderGuid: payload.order_guid,
        error: error instanceof Error ? error.message : error,
      });
    }

    // Find the order using the TMS GUID (Super Dispatch integration)
    const order = await Order.findOne({ "tms.guid": payload.order_guid });

    if (!order) {
      logger.warn("Order not found for Super Dispatch delivery", {
        orderGuid: payload.order_guid,
      });

      return {
        success: false,
        message: "Order not found in system",
        processedAt: new Date().toISOString(),
      };
    }

    // Update order status and delivery information
    order.status = Status.Complete;
    order.tms.status = "delivered";
    order.tms.updatedAt = new Date();

    // Add delivery confirmation fields (like old API)
    // order.awaitingDeliveryConfirmation = true;
    // order.orderTableDeliveryActual = new Date();

    await order.save();

    logger.info("Order delivered successfully", {
      orderId: order._id,
      refId: order.refId,
      tmsGuid: payload.order_guid,
    });

    return {
      success: true,
      message: "Order delivered successfully",
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error processing Super Dispatch order delivered", {
      orderGuid: payload.order_guid,
      error: error instanceof Error ? error.message : error,
    });

    throw error;
  }
};

export const handleSuperDispatchOrderInvoiced = async (
  payload: ISuperDispatchOrderInvoicedPayload,
  headers: Record<string, string>,
): Promise<IWebhookResponse> => {
  try {
    logger.info("Processing Super Dispatch order invoiced", {
      orderGuid: payload.order_guid,
    });

    // Find the order using the TMS GUID (Super Dispatch integration)
    const order = await Order.findOne({ "tms.guid": payload.order_guid });

    if (!order) {
      logger.warn("Order not found for Super Dispatch invoiced", {
        orderGuid: payload.order_guid,
      });

      return {
        success: false,
        message: "Order not found in system",
        processedAt: new Date().toISOString(),
      };
    }

    // Update order status and invoicing information
    order.tms.status = "invoiced";
    order.tms.updatedAt = new Date();

    // Add invoicing confirmation fields (like old API)
    // if (order.awaitingDeliveryConfirmation === null) {
    //   order.awaitingDeliveryConfirmation = true;
    // }
    // if (!order.orderTableDeliveryActual) {
    //   order.orderTableDeliveryActual = new Date();
    // }

    await order.save();

    logger.info("Order invoiced successfully", {
      orderId: order._id,
      refId: order.refId,
      tmsGuid: payload.order_guid,
    });

    return {
      success: true,
      message: "Order invoiced successfully",
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error processing Super Dispatch order invoiced", {
      orderGuid: payload.order_guid,
      error: error instanceof Error ? error.message : error,
    });

    throw error;
  }
};

export const handleSuperDispatchOrderModified = async (
  payload: ISuperDispatchOrderModifiedPayload,
  headers: Record<string, string>,
): Promise<IWebhookResponse> => {
  try {
    logger.info("Processing Super Dispatch order modified", {
      orderGuid: payload.order_guid,
    });

    // Log the full webhook payload for debugging (like the old API)
    logger.info(
      "Order modified webhook received:",
      JSON.stringify(payload, null, 2),
    );

    // Find the order using the TMS GUID (Super Dispatch integration)
    const order = await Order.findOne({ "tms.guid": payload.order_guid });

    if (!order) {
      logger.warn("Order not found for Super Dispatch modified", {
        orderGuid: payload.order_guid,
      });

      return {
        success: false,
        message: "Order not found in system",
        processedAt: new Date().toISOString(),
      };
    }

    logger.info("Modifying order", {
      orderId: order._id,
      refId: order.refId,
      tmsGuid: payload.order_guid,
    });

    // Update order modification timestamp
    order.tms.updatedAt = new Date();

    // Add uniqueIdNum field (like old API)
    // order.uniqueIdNum = parseInt(order.uniqueId);

    await order.save();

    logger.info("Order modified successfully", {
      orderId: order._id,
      refId: order.refId,
      tmsGuid: payload.order_guid,
    });

    return {
      success: true,
      message: "Order modified successfully",
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error processing Super Dispatch order modified", {
      orderGuid: payload.order_guid,
      error: error instanceof Error ? error.message : error,
    });

    throw error;
  }
};

export const handleSuperDispatchOrderPickedUp = async (
  payload: ISuperDispatchOrderPickedUpPayload,
  headers: Record<string, string>,
): Promise<IWebhookResponse> => {
  try {
    logger.info("Processing Super Dispatch order picked up", {
      orderGuid: payload.order_guid,
    });

    // Find the order using the TMS GUID (Super Dispatch integration)
    const order = await Order.findOne({ "tms.guid": payload.order_guid });

    if (!order) {
      logger.warn("Order not found for Super Dispatch picked up", {
        orderGuid: payload.order_guid,
      });

      return {
        success: false,
        message: "Order not found in system",
        processedAt: new Date().toISOString(),
      };
    }

    // Update order status and pickup information
    order.tms.status = "picked_up";
    order.tms.updatedAt = new Date();

    // Add pickup confirmation fields (like old API)
    // order.awaitingPickupConfirmation = true;
    // order.orderTablePickupActual = new Date();

    await order.save();

    logger.info("Order picked up successfully", {
      orderId: order._id,
      refId: order.refId,
      tmsGuid: payload.order_guid,
    });

    return {
      success: true,
      message: "Order picked up successfully",
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error processing Super Dispatch order picked up", {
      orderGuid: payload.order_guid,
      error: error instanceof Error ? error.message : error,
    });

    throw error;
  }
};

export const handleSuperDispatchVehicleModified = async (
  payload: ISuperDispatchVehicleModifiedPayload,
  headers: Record<string, string>,
): Promise<IWebhookResponse> => {
  try {
    logger.info("Processing Super Dispatch vehicle modified", {
      orderGuid: payload.order_guid,
    });

    // Log the full webhook payload for debugging (like the old API)
    logger.info("webhookVehicleModified", payload);

    // Find the order using the TMS GUID (Super Dispatch integration)
    const order = await Order.findOne({ "tms.guid": payload.order_guid });

    if (!order) {
      logger.warn("Order not found for Super Dispatch vehicle modified", {
        orderGuid: payload.order_guid,
      });

      return {
        success: false,
        message: "Order not found in system",
        processedAt: new Date().toISOString(),
      };
    }

    // Update order modification timestamp
    order.tms.updatedAt = new Date();

    // Add uniqueIdNum field (like old API)
    // order.uniqueIdNum = parseInt(order.uniqueId);

    await order.save();

    logger.info("Vehicle modified successfully", {
      orderId: order._id,
      refId: order.refId,
      tmsGuid: payload.order_guid,
    });

    return {
      success: true,
      message: "Vehicle modified successfully",
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error processing Super Dispatch vehicle modified", {
      orderGuid: payload.order_guid,
      error: error instanceof Error ? error.message : error,
    });

    throw error;
  }
};

// Carrier webhook handlers
export const handleCarrierAccepted = async (
  payload: ICarrierAcceptedPayload,
  headers: Record<string, string>,
): Promise<IWebhookResponse> => {
  try {
    logger.info("Processing carrier accepted webhook", {
      orderGuid: payload.order_guid,
      carrierGuid: payload.carrier_guid,
    });

    if (!payload.carrier_guid) {
      logger.warn("Carrier accepted webhook missing carrier data");
      return {
        success: false,
        message: "Missing carrier_guid",
        processedAt: new Date().toISOString(),
      };
    }

    // Find or create carrier
    let carrierDoc = await Carrier.findOne({ guid: payload.carrier_guid });

    if (carrierDoc) {
      // Add activity entry
      if (!carrierDoc.activity) {
        carrierDoc.activity = [];
      }
      carrierDoc.activity.push({
        type: "accepted_order",
        date: new Date(),
        notes: `Accepted order ${payload.order_guid}`,
      });

      await carrierDoc.save();
      logger.info(`Updated carrier: ${payload.carrier_guid}`);
    } else {
      // Create new carrier
      carrierDoc = new Carrier({
        guid: payload.carrier_guid,
        status: "new",
        activity: [
          {
            type: "accepted_order",
            date: new Date(),
            notes: `Accepted order ${payload.order_guid}`,
          },
        ],
      });

      await carrierDoc.save();
      logger.info(`Created new carrier: ${payload.carrier_guid}`);
    }

    // Update order if order_guid provided
    if (payload.order_guid) {
      const order = await Order.findOne({ "tms.guid": payload.order_guid });
      if (order) {
        logger.info(
          `Order ${payload.order_guid} accepted by carrier ${payload.carrier_guid}`,
        );
      }
    }

    return {
      success: true,
      message: "Carrier accepted successfully",
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error processing carrier accepted", {
      orderGuid: payload.order_guid,
      carrierGuid: payload.carrier_guid,
      error: error instanceof Error ? error.message : error,
    });

    throw error;
  }
};

export const handleCarrierCanceled = async (
  payload: ICarrierCanceledPayload,
  headers: Record<string, string>,
): Promise<IWebhookResponse> => {
  try {
    logger.info("Processing carrier canceled webhook", {
      orderGuid: payload.order_guid,
      carrierGuid: payload.carrier_guid,
    });

    if (!payload.carrier_guid) {
      logger.warn("Carrier canceled webhook missing carrier data");
      return {
        success: false,
        message: "Missing carrier_guid",
        processedAt: new Date().toISOString(),
      };
    }

    // Find or create carrier
    let carrierDoc = await Carrier.findOne({ guid: payload.carrier_guid });

    if (carrierDoc) {
      // Add activity entry
      if (!carrierDoc.activity) {
        carrierDoc.activity = [];
      }
      carrierDoc.activity.push({
        type: "canceled_order",
        date: new Date(),
        notes: `Canceled order ${payload.order_guid}`,
      });

      await carrierDoc.save();
      logger.info(`Carrier canceled order: ${payload.carrier_guid}`);
    } else {
      // Carrier not found in database - create it and add activity
      logger.info(
        `Creating new carrier ${payload.carrier_guid} from cancellation webhook`,
      );

      carrierDoc = new Carrier({
        guid: payload.carrier_guid,
        name: payload.carrier_name || "Unknown Carrier",
        email: payload.carrier_email || undefined,
        status: "unknown",
        activity: [
          {
            type: "canceled_order",
            date: new Date(),
            notes: `Canceled order ${payload.order_guid}`,
          },
        ],
      });

      await carrierDoc.save();
      logger.info(
        `Created carrier ${payload.carrier_guid} with cancellation activity`,
      );
    }

    // Log carrier cancellation
    if (payload.order_guid) {
      logger.info(
        `Carrier ${payload.carrier_guid} canceled order ${payload.order_guid}`,
      );
    } else {
      logger.warn("Carrier canceled webhook missing order_guid");
    }

    return {
      success: true,
      message: "Carrier canceled successfully",
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error processing carrier canceled", {
      orderGuid: payload.order_guid,
      carrierGuid: payload.carrier_guid,
      error: error instanceof Error ? error.message : error,
    });

    throw error;
  }
};

export const handleSuperDispatchOrderRemoved = async (
  payload: ISuperDispatchOrderRemovedPayload,
  headers: Record<string, string>,
): Promise<IWebhookResponse> => {
  try {
    logger.info("Processing Super Dispatch order removed", {
      orderGuid: payload.order_guid,
    });

    // Find the order using the TMS GUID (Super Dispatch integration)
    const order = await Order.findOne({ "tms.guid": payload.order_guid });

    if (!order) {
      logger.warn("Order not found for Super Dispatch removal", {
        orderGuid: payload.order_guid,
      });

      return {
        success: false,
        message: "Order not found in system",
        processedAt: new Date().toISOString(),
      };
    }

    // Update order status to archived (removed/canceled)
    order.status = Status.Archived;
    order.tms.status = "order_canceled";
    order.tms.updatedAt = new Date();

    await order.save();

    logger.info("Order removed successfully", {
      orderId: order._id,
      refId: order.refId,
      tmsGuid: payload.order_guid,
    });

    return {
      success: true,
      message: "Order removed successfully",
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error processing Super Dispatch order removed", {
      orderGuid: payload.order_guid,
      error: error instanceof Error ? error.message : error,
    });

    throw error;
  }
};

export const handleCarrierAcceptedByShipper = async (
  payload: ICarrierAcceptedByShipperPayload,
  headers: Record<string, string>,
): Promise<IWebhookResponse> => {
  try {
    logger.info("Processing carrier accepted by shipper webhook", {
      orderGuid: payload.order_guid,
      carrierGuid: payload.carrier_guid,
    });

    if (!payload.carrier_guid) {
      logger.warn("Carrier accepted by shipper webhook missing carrier data");
      return {
        success: false,
        message: "Missing carrier_guid",
        processedAt: new Date().toISOString(),
      };
    }

    // Find or create carrier
    let carrierDoc = await Carrier.findOne({ guid: payload.carrier_guid });

    if (!carrierDoc) {
      // Create new carrier
      carrierDoc = new Carrier({
        guid: payload.carrier_guid,
        status: "approved",
        activity: [
          {
            type: "accepted_order",
            date: new Date(),
            notes: `Accepted order ${payload.order_guid}`,
          },
        ],
      });

      await carrierDoc.save();
      logger.info(`Created new carrier: ${payload.carrier_guid}`);
    } else {
      logger.info(
        `Carrier ${payload.carrier_guid} already exists, accepted order ${payload.order_guid}`,
      );
    }

    // Handle order updates if order_guid provided
    if (payload.order_guid) {
      const order = await Order.findOne({ "tms.guid": payload.order_guid });

      if (order) {
        logger.info(
          `Processing order ${order.refId} (${payload.order_guid}) after shipper accepted carrier`,
        );

        // If this was a partial order, release full details
        // Note: This would require the updateSuperWithCompleteOrder service
        // For now, we'll just log it
        if ((order as any).tmsPartialOrder === true) {
          logger.info(
            `Order ${order.refId} (${payload.order_guid}) was a partial order. Full details should be released to SuperDispatch.`,
          );
          // TODO: Implement updateSuperWithCompleteOrder if needed
        }
      } else {
        logger.warn(`Order not found for tms.guid: ${payload.order_guid}`);
      }
    }

    return {
      success: true,
      message: "Carrier accepted by shipper successfully",
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error processing carrier accepted by shipper", {
      orderGuid: payload.order_guid,
      carrierGuid: payload.carrier_guid,
      error: error instanceof Error ? error.message : error,
    });

    throw error;
  }
};

export const handleOfferSent = async (
  payload: IOfferSentPayload,
  headers: Record<string, string>,
): Promise<IWebhookResponse> => {
  try {
    logger.info("Processing offer sent to carrier webhook", {
      orderGuid: payload.order_guid,
      carrierGuid: payload.carrier_guid,
    });

    if (!payload.carrier_guid || !payload.order_guid) {
      logger.warn("Offer sent webhook missing data");
      return {
        success: false,
        message: "Missing carrier_guid or order_guid",
        processedAt: new Date().toISOString(),
      };
    }

    // Find or create carrier
    let carrierDoc = await Carrier.findOne({ guid: payload.carrier_guid });

    if (carrierDoc) {
      // Add activity entry
      if (!carrierDoc.activity) {
        carrierDoc.activity = [];
      }
      carrierDoc.activity.push({
        type: "sent_offer",
        date: new Date(),
        notes: `Sent offer for order ${payload.order_guid}`,
      });

      await carrierDoc.save();
      logger.info(`Updated carrier: ${payload.carrier_guid}`);
    } else {
      // Create new carrier
      carrierDoc = new Carrier({
        guid: payload.carrier_guid,
        status: "approved",
        activity: [
          {
            type: "sent_offer",
            date: new Date(),
            notes: `Sent offer for order ${payload.order_guid}`,
          },
        ],
      });

      await carrierDoc.save();
      logger.info(`Created new carrier: ${payload.carrier_guid}`);
    }

    return {
      success: true,
      message: "Offer sent successfully",
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error processing offer sent", {
      orderGuid: payload.order_guid,
      carrierGuid: payload.carrier_guid,
      error: error instanceof Error ? error.message : error,
    });

    throw error;
  }
};
