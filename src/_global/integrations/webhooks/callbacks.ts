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

/** Log label — search logs for `acertusVehicleHaulWebhook` */
const ACERTUS_WEBHOOK_LOG = "acertusVehicleHaulWebhook";

const summarizeAcertusVehicleHaulBody = (body: any) => {
  const load = body?.load;
  const vehicles = Array.isArray(load?.vehicles) ? load.vehicles : [];
  return {
    loadNumber: load?.number ?? null,
    loadConnectUid: load?.connect_uid ?? null,
    vehicleCount: vehicles.length,
    vehicles: vehicles.map((v: any, index: number) => ({
      index,
      connectUid: v?.connect_uid ?? null,
      vin: v?.vin ?? null,
      make: v?.make ?? null,
      model: v?.model ?? null,
      originZip: v?.origin?.zip ?? null,
      destinationZip: v?.destination?.zip ?? null,
    })),
  };
};

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
  const receivedAt = new Date().toISOString();

  try {
    if (!req.body) {
      logger.error(ACERTUS_WEBHOOK_LOG, {
        outcome: "rejected_no_body",
        path: "/callback/vehicle-haul",
        receivedAt,
      });
      return res.status(400).json({ error: "No request body" });
    }

    const summary = summarizeAcertusVehicleHaulBody(req.body);

    logger.info(ACERTUS_WEBHOOK_LOG, {
      outcome: "received",
      path: "/callback/vehicle-haul",
      receivedAt,
      method: req.method,
      contentType: req.get("Content-Type"),
      userAgent: req.get("User-Agent"),
      ip: req.ip,
      ...summary,
      rawBody: req.body,
    });

    res.status(200).json({ received: true });

    logger.info(ACERTUS_WEBHOOK_LOG, {
      outcome: "acknowledged_200",
      loadNumber: summary.loadNumber,
      receivedAt,
    });

    processAcertusLoad(req.body, { receivedAt, summary }).catch((error) => {
      logger.error(ACERTUS_WEBHOOK_LOG, {
        outcome: "async_processing_failed",
        loadNumber: summary.loadNumber,
        receivedAt,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    });
  } catch (error) {
    logger.error(ACERTUS_WEBHOOK_LOG, {
      outcome: "handler_exception",
      receivedAt,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      rawBody: req.body,
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
async function processAcertusLoad(
  data: any,
  context: { receivedAt: string; summary: ReturnType<typeof summarizeAcertusVehicleHaulBody> },
): Promise<void> {
  const { receivedAt, summary } = context;
  const loadNumber = summary.loadNumber;

  try {
    logger.info(ACERTUS_WEBHOOK_LOG, {
      outcome: "processing_started",
      loadNumber,
      receivedAt,
      ...summary,
    });

    if (!data || !data.load || !data.load.number) {
      logger.error(ACERTUS_WEBHOOK_LOG, {
        outcome: "validation_failed",
        reason: "missing load.number",
        loadNumber,
        receivedAt,
        rawBody: data,
      });
      return;
    }

    const vehicles = data.load.vehicles || [];

    if (vehicles.length === 0) {
      logger.warn(ACERTUS_WEBHOOK_LOG, {
        outcome: "skipped_no_vehicles",
        loadNumber,
        receivedAt,
      });
      return;
    }

    const connectUid =
      data.load.connect_uid || vehicles[0]?.connect_uid || null;

    const vehicle = vehicles[0];
    const originZip = vehicle?.origin?.zip;
    const destinationZip = vehicle?.destination?.zip;

    if (!originZip || !destinationZip) {
      logger.warn(ACERTUS_WEBHOOK_LOG, {
        outcome: "skipped_missing_zips",
        loadNumber,
        connectUid,
        originZip: originZip ?? null,
        destinationZip: destinationZip ?? null,
        receivedAt,
        firstVehicle: summary.vehicles[0] ?? null,
      });
      return;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const portalObjectId = new Types.ObjectId(AUTONATION_PORTAL_ID);

    const orderQuery = {
      portalId: portalObjectId,
      "origin.address.zip": originZip,
      "destination.address.zip": destinationZip,
      createdAt: { $gte: thirtyDaysAgo },
    };

    logger.info(ACERTUS_WEBHOOK_LOG, {
      outcome: "order_lookup",
      loadNumber,
      connectUid,
      originZip,
      destinationZip,
      portalId: AUTONATION_PORTAL_ID,
      createdAfter: thirtyDaysAgo.toISOString(),
      orderQuery,
    });

    const order = await Order.findOne(orderQuery);

    if (!order) {
      logger.warn(ACERTUS_WEBHOOK_LOG, {
        outcome: "order_not_found",
        loadNumber,
        connectUid,
        originZip,
        destinationZip,
        portalId: AUTONATION_PORTAL_ID,
        createdAfter: thirtyDaysAgo.toISOString(),
        receivedAt,
      });
      return;
    }

    const previousAcertusLoadNumber = order.acertusLoadNumber ?? null;
    const previousAcertusConnectUid = order.acertusConnectUid ?? null;

    logger.info(ACERTUS_WEBHOOK_LOG, {
      outcome: "order_matched",
      loadNumber,
      connectUid,
      orderId: order._id,
      refId: order.refId,
      originZip,
      destinationZip,
      previousAcertusLoadNumber,
      previousAcertusConnectUid,
    });

    order.acertusLoadNumber = String(data.load.number);
    if (connectUid !== null && connectUid !== undefined) {
      order.acertusConnectUid = String(connectUid);
    }

    try {
      await order.save();
      logger.info(ACERTUS_WEBHOOK_LOG, {
        outcome: "order_updated",
        loadNumber,
        connectUid,
        orderId: order._id,
        refId: order.refId,
        acertusLoadNumber: order.acertusLoadNumber,
        acertusConnectUid: order.acertusConnectUid,
        previousAcertusLoadNumber,
        previousAcertusConnectUid,
        receivedAt,
      });
    } catch (saveError) {
      logger.error(ACERTUS_WEBHOOK_LOG, {
        outcome: "order_save_failed",
        loadNumber,
        orderId: order._id,
        refId: order.refId,
        error:
          saveError instanceof Error ? saveError.message : String(saveError),
        stack: saveError instanceof Error ? saveError.stack : undefined,
      });

      if (saveError instanceof Error && "name" in saveError) {
        if (saveError.name === "ValidationError") {
          logger.error(ACERTUS_WEBHOOK_LOG, {
            outcome: "order_save_validation_error",
            refId: order.refId,
            errors: (saveError as any).errors,
          });
        } else if (saveError.name === "CastError") {
          logger.error(ACERTUS_WEBHOOK_LOG, {
            outcome: "order_save_cast_error",
            refId: order.refId,
            message: saveError.message,
          });
        }
      }

      return;
    }
  } catch (error) {
    logger.error(ACERTUS_WEBHOOK_LOG, {
      outcome: "processing_failed",
      loadNumber,
      receivedAt,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export default router;
