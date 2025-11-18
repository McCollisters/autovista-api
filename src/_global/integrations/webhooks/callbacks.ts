/**
 * Super Dispatch Callback Routes
 *
 * This file provides callback endpoints that Super Dispatch expects.
 * These endpoints match the old API structure for backward compatibility.
 */

import { Router, Request, Response, NextFunction } from "express";
import { logger } from "@/core/logger";
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

export default router;
