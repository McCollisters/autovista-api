/**
 * Super Dispatch Callback Routes
 *
 * This file provides callback endpoints that Super Dispatch expects.
 * These endpoints match the old API structure for backward compatibility.
 */

import { Router, Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { logger } from "@/core/logger";
import { Order } from "@/_global/models";
import {
  handleSuperDispatchOrderCancelled,
  handleSuperDispatchOrderPickedUp,
  handleSuperDispatchOrderDelivered,
  handleSuperDispatchOrderInvoiced,
  handleSuperDispatchOrderRemoved,
  handleSuperDispatchOrderModified,
  handleSuperDispatchVehicleModified,
  handleCarrierAcceptedByShipper,
  handleCarrierAccepted,
  handleCarrierCanceled,
  handleOfferSent,
} from "./handlers";
import {
  ISuperDispatchOrderCancelledPayload,
  ISuperDispatchOrderDeliveredPayload,
  ISuperDispatchOrderInvoicedPayload,
  ISuperDispatchOrderRemovedPayload,
  ISuperDispatchOrderModifiedPayload,
  ISuperDispatchOrderPickedUpPayload,
  ISuperDispatchVehicleModifiedPayload,
  ICarrierAcceptedByShipperPayload,
  ICarrierAcceptedPayload,
  ICarrierCanceledPayload,
  IOfferSentPayload,
} from "./types";

// Autonation portal ID for Acertus integration
const AUTONATION_PORTAL_ID =
  process.env.ACERTUS_AUTONATION_PORTAL_ID || "62b89733d996a00046fe815e";

const router = Router();

// Helper function to process webhook asynchronously
const processAsync = async (
  req: Request,
  res: Response,
  handler: (payload: any, headers: Record<string, string>) => Promise<any>,
  payload: any,
): Promise<void> => {
  try {
    // Immediately respond to avoid timeout (following old API pattern)
    res.status(200).json({ received: true });

    // Process asynchronously
    handler(payload, req.headers as Record<string, string>).catch((error) => {
      logger.error("Error processing webhook asynchronously:", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        payload,
      });
    });
  } catch (error) {
    logger.error("Unexpected error in webhook handler:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (!res.headersSent) {
      res.status(500).json({ error: "Webhook error" });
    }
  }
};

// Super Dispatch callback endpoints
router.post("/order-cancel", async (req: Request, res: Response) => {
  if (!req.body || !req.body.order_guid) {
    logger.error("No request body or order_guid received for order cancel");
    return res.status(400).json({ error: "No request body or order_guid" });
  }

  logger.info("Received order cancel callback:", {
    order_guid: req.body.order_guid,
    timestamp: new Date().toISOString(),
  });

  const payload: ISuperDispatchOrderCancelledPayload = {
    order_guid: req.body.order_guid,
  };

  await processAsync(req, res, handleSuperDispatchOrderCancelled, payload);
});

router.post("/order-picked-up", async (req: Request, res: Response) => {
  if (!req.body || !req.body.order_guid) {
    logger.error("No request body or order_guid received for order picked up");
    return res.status(400).json({ error: "No request body or order_guid" });
  }

  logger.info("Received order picked up callback:", {
    order_guid: req.body.order_guid,
    timestamp: new Date().toISOString(),
  });

  const payload: ISuperDispatchOrderPickedUpPayload = {
    order_guid: req.body.order_guid,
  };

  await processAsync(req, res, handleSuperDispatchOrderPickedUp, payload);
});

router.post("/order-delivered", async (req: Request, res: Response) => {
  if (!req.body || !req.body.order_guid) {
    logger.error("No request body or order_guid received for order delivered");
    return res.status(400).json({ error: "No request body or order_guid" });
  }

  logger.info("Received order delivered callback:", {
    order_guid: req.body.order_guid,
    timestamp: new Date().toISOString(),
  });

  const payload: ISuperDispatchOrderDeliveredPayload = {
    order_guid: req.body.order_guid,
  };

  await processAsync(req, res, handleSuperDispatchOrderDelivered, payload);
});

router.post("/order-invoiced", async (req: Request, res: Response) => {
  if (!req.body || !req.body.order_guid) {
    logger.error("No request body or order_guid received for order invoiced");
    return res.status(400).json({ error: "No request body or order_guid" });
  }

  logger.info("Received order invoiced callback:", {
    order_guid: req.body.order_guid,
    timestamp: new Date().toISOString(),
  });

  const payload: ISuperDispatchOrderInvoicedPayload = {
    order_guid: req.body.order_guid,
  };

  await processAsync(req, res, handleSuperDispatchOrderInvoiced, payload);
});

router.post("/order-removed", async (req: Request, res: Response) => {
  if (!req.body || !req.body.order_guid) {
    logger.error("No request body or order_guid received for order removed");
    return res.status(400).json({ error: "No request body or order_guid" });
  }

  logger.info("Received order removed callback:", {
    order_guid: req.body.order_guid,
    timestamp: new Date().toISOString(),
  });

  const payload: ISuperDispatchOrderRemovedPayload = {
    order_guid: req.body.order_guid,
  };

  await processAsync(req, res, handleSuperDispatchOrderRemoved, payload);
});

router.post("/order-modified", async (req: Request, res: Response) => {
  if (!req.body || !req.body.order_guid) {
    logger.error("No request body or order_guid received for order modified");
    return res.status(400).json({ error: "No request body or order_guid" });
  }

  logger.info("Received order modified callback:", {
    order_guid: req.body.order_guid,
    timestamp: new Date().toISOString(),
  });

  const payload: ISuperDispatchOrderModifiedPayload = {
    order_guid: req.body.order_guid,
    ...req.body,
  };

  await processAsync(req, res, handleSuperDispatchOrderModified, payload);
});

router.post("/vehicle-modified", async (req: Request, res: Response) => {
  if (!req.body || !req.body.order_guid) {
    logger.error("No request body or order_guid received for vehicle modified");
    return res.status(400).json({ error: "No request body or order_guid" });
  }

  logger.info("Received vehicle modified callback:", {
    order_guid: req.body.order_guid,
    timestamp: new Date().toISOString(),
  });

  const payload: ISuperDispatchVehicleModifiedPayload = {
    order_guid: req.body.order_guid,
  };

  await processAsync(req, res, handleSuperDispatchVehicleModified, payload);
});

router.post("/accepted-carrier", async (req: Request, res: Response) => {
  if (!req.body || !req.body.order_guid || !req.body.carrier_guid) {
    logger.error(
      "No request body or missing order_guid/carrier_guid for accepted carrier",
    );
    return res
      .status(400)
      .json({ error: "No request body or missing required fields" });
  }

  logger.info("Received accepted carrier callback:", {
    order_guid: req.body.order_guid,
    carrier_guid: req.body.carrier_guid,
    timestamp: new Date().toISOString(),
  });

  const payload: ICarrierAcceptedByShipperPayload = {
    order_guid: req.body.order_guid,
    carrier_guid: req.body.carrier_guid,
  };

  await processAsync(req, res, handleCarrierAcceptedByShipper, payload);
});

router.post("/carrier-accepted", async (req: Request, res: Response) => {
  if (!req.body || !req.body.order_guid || !req.body.carrier_guid) {
    logger.error(
      "No request body or missing order_guid/carrier_guid for carrier accepted",
    );
    return res
      .status(400)
      .json({ error: "No request body or missing required fields" });
  }

  logger.info("Received carrier accepted callback:", {
    order_guid: req.body.order_guid,
    carrier_guid: req.body.carrier_guid,
    timestamp: new Date().toISOString(),
  });

  const payload: ICarrierAcceptedPayload = {
    order_guid: req.body.order_guid,
    carrier_guid: req.body.carrier_guid,
  };

  await processAsync(req, res, handleCarrierAccepted, payload);
});

router.post("/carrier-canceled", async (req: Request, res: Response) => {
  if (!req.body || !req.body.carrier_guid) {
    logger.error(
      "No request body or missing carrier_guid for carrier canceled",
    );
    return res
      .status(400)
      .json({ error: "No request body or missing carrier_guid" });
  }

  logger.info("Received carrier canceled callback:", {
    order_guid: req.body.order_guid,
    carrier_guid: req.body.carrier_guid,
    timestamp: new Date().toISOString(),
  });

  const payload: ICarrierCanceledPayload = {
    order_guid: req.body.order_guid,
    carrier_guid: req.body.carrier_guid,
    carrier_name: req.body.carrier_name,
    carrier_email: req.body.carrier_email,
  };

  await processAsync(req, res, handleCarrierCanceled, payload);
});

router.post("/offer-sent", async (req: Request, res: Response) => {
  if (!req.body || !req.body.order_guid || !req.body.carrier_guid) {
    logger.error(
      "No request body or missing order_guid/carrier_guid for offer sent",
    );
    return res
      .status(400)
      .json({ error: "No request body or missing required fields" });
  }

  logger.info("Received offer sent callback:", {
    order_guid: req.body.order_guid,
    carrier_guid: req.body.carrier_guid,
    timestamp: new Date().toISOString(),
  });

  const payload: IOfferSentPayload = {
    order_guid: req.body.order_guid,
    carrier_guid: req.body.carrier_guid,
  };

  await processAsync(req, res, handleOfferSent, payload);
});

// Acertus load webhook endpoint
router.post("/vehicle-haul", async (req: Request, res: Response) => {
  try {
    // Validate request body
    if (!req.body) {
      logger.error("No request body received for acertus load webhook");
      return res.status(400).json({ error: "No request body" });
    }

    logger.info("Received acertus load webhook:", {
      loadNumber: req.body?.load?.number,
      timestamp: new Date().toISOString(),
      userAgent: req.get("User-Agent"),
    });

    // Immediately respond to avoid timeout
    res.status(200).json({ received: true });

    // Process asynchronously with better error handling
    processAcertusLoad(req.body).catch((error) => {
      logger.error("Error processing acertus load webhook:", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        loadNumber: req.body?.load?.number,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (error) {
    logger.error("Unexpected error in acertus load webhook handler:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body,
      timestamp: new Date().toISOString(),
    });

    if (!res.headersSent) {
      res.status(500).json({ error: "Webhook error" });
    }
  }
});

/**
 * Process Acertus load webhook data asynchronously
 * Matches the load with an order based on portalId and zip codes
 * Updates the order with acertusLoadNumber and acertusConnectUid
 */
async function processAcertusLoad(data: any): Promise<void> {
  try {
    // Validate webhook data
    if (!data || !data.load || !data.load.number) {
      logger.error("Invalid webhook data received for acertus load:", data);
      return;
    }

    const loadNumber = data.load.number;
    const vehicles = data.load.vehicles || [];

    if (vehicles.length === 0) {
      logger.warn("No vehicles found in acertus load webhook");
      return;
    }

    // Get connect_uid from load or fall back to first vehicle's connect_uid
    const connectUid =
      data.load.connect_uid || vehicles[0]?.connect_uid || null;

    // Get origin and destination zip codes from first vehicle
    const vehicle = vehicles[0];
    const originZip = vehicle?.origin?.zip;
    const destinationZip = vehicle?.destination?.zip;

    if (!originZip || !destinationZip) {
      logger.warn("Missing origin or destination zip in acertus load webhook:", {
        originZip,
        destinationZip,
        loadNumber,
      });
      return;
    }

    logger.info("Processing acertus load webhook:", {
      loadNumber,
      connectUid,
      originZip,
      destinationZip,
    });

    // Find order created in the past 30 days with matching portalId and zip codes
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const portalObjectId = new Types.ObjectId(AUTONATION_PORTAL_ID);

    const order = await Order.findOne({
      portalId: portalObjectId,
      "origin.address.zip": originZip,
      "destination.address.zip": destinationZip,
      createdAt: { $gte: thirtyDaysAgo },
    });

    if (!order) {
      logger.warn("Order not found for acertus load webhook:", {
        loadNumber,
        originZip,
        destinationZip,
        portalId: AUTONATION_PORTAL_ID,
      });
      return;
    }

    logger.info(`Found order ${order.refId} for acertus load ${loadNumber}`);

    // Update order with acertus load number and connect uid
    order.acertusLoadNumber = loadNumber;
    if (connectUid !== null) {
      order.acertusConnectUid = connectUid;
    }

    try {
      await order.save();
      logger.info(
        `Successfully updated order ${order.refId} with acertus load number ${loadNumber} and connect uid ${connectUid}`,
      );
    } catch (saveError) {
      logger.error(`Failed to save order ${order.refId}:`, {
        error:
          saveError instanceof Error ? saveError.message : String(saveError),
        stack: saveError instanceof Error ? saveError.stack : undefined,
      });

      // Check for specific MongoDB errors
      if (saveError instanceof Error && "name" in saveError) {
        if (saveError.name === "ValidationError") {
          logger.error(
            `Validation error for order ${order.refId}:`,
            (saveError as any).errors,
          );
        } else if (saveError.name === "CastError") {
          logger.error(
            `Cast error for order ${order.refId}:`,
            saveError.message,
          );
        }
      }

      throw saveError;
    }
  } catch (error) {
    logger.error("Error in processAcertusLoad:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      loadNumber: data?.load?.number,
    });
    throw error;
  }
}

export default router;
