/**
 * Acertus Integration Client
 *
 * This module handles integration with Acertus (Vehichaul) for Autonation portal orders.
 * It provides functionality to:
 * - Create vehicles in Acertus
 * - Send order updates to Acertus
 * - Send pickup/delivery ETAs
 * - Assign vehicles to loads
 */

import axios from "axios";
import { logger } from "@/core/logger";
import { IOrder } from "../schema";

const AUTONATION_PORTAL_ID = process.env.ACERTUS_AUTONATION_PORTAL_ID || "62b89733d996a00046fe815e";
const DEFAULT_TIMEOUT_MS = parseInt(
  process.env.ACERTUS_TIMEOUT_MS || "15000",
  10,
);
const API_ENDPOINT =
  process.env.ACERTUS_API_URL ||
  "https://mccollistersstaging.vehichaul.com/api/order-updates";
const BASE_URL =
  process.env.ACERTUS_BASE_URL || "https://mccollistersstaging.vehichaul.com/";
const API_KEY = process.env.ACERTUS_API_KEY;

const PICKUP_PATH = "/api/connect/broker/vehicle/pickup/eta";
const DELIVERY_PATH = "/api/connect/broker/vehicle/delivery/eta";
const ASSIGN_PATH = "/api/connect/broker/vehicle/assign";
const CUSTOMER_VEHICLE_PATH = "/api/connect/customer/vehicle";

const CONNECT_UID =
  process.env.ACERTUS_CONNECT_UID &&
  Number.parseInt(process.env.ACERTUS_CONNECT_UID, 10);
const DEFAULT_CARRIER_NAME = process.env.ACERTUS_CARRIER_NAME || "ACERTUS";
const DEFAULT_CARRIER_SCAC = process.env.ACERTUS_CARRIER_SCAC || "";
const DEFAULT_CARRIER_IDENTIFIER =
  process.env.ACERTUS_CARRIER_IDENTIFIER || "default";
const VEHICLE_CONNECT_UID_PREFIX =
  process.env.ACERTUS_VEHICLE_CONNECT_UID_PREFIX || "autonation";

/**
 * Check if Acertus integration is enabled
 */
const isAcertusEnabled = (): boolean => {
  return process.env.ENABLE_ACERTUS === "true";
};

/**
 * Sanitize date value to ISO string or null
 */
const sanitizeDate = (value: any): string | null => {
  if (!value) {
    return null;
  }

  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  } catch (error) {
    logger.warn("acertusClient: Failed to sanitize date value", {
      value,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Get portal ID as string
 */
const getPortalIdString = (portalId: any): string | null => {
  if (!portalId) {
    return null;
  }

  if (typeof portalId === "string") {
    return portalId;
  }

  if (typeof portalId === "object" && portalId.toString) {
    return portalId.toString();
  }

  return `${portalId}`;
};

/**
 * Check if order is from Autonation portal
 */
export const isAutonationPortal = (order: any): boolean => {
  if (!order) {
    return false;
  }

  const portalId = getPortalIdString(order.portalId || order.portal);
  return portalId === AUTONATION_PORTAL_ID;
};

/**
 * Remove null/undefined values from object
 */
const removeNullish = (value: any): any => {
  if (Array.isArray(value)) {
    return value
      .map((item) => removeNullish(item))
      .filter((item) => item !== null && item !== undefined);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, val]) => {
      const cleaned = removeNullish(val);
      if (
        cleaned !== null &&
        cleaned !== undefined &&
        !(
          typeof cleaned === "object" &&
          !Array.isArray(cleaned) &&
          Object.keys(cleaned).length === 0
        )
      ) {
        acc[key] = cleaned;
      }
      return acc;
    }, {} as any);
  }

  return value;
};

/**
 * Build base payload for order updates
 */
const buildBasePayload = (order: any) => {
  if (!order) {
    return {};
  }

  const pickup = order.origin || {};
  const delivery = order.destination || {};
  const schedule = order.schedule || {};

  return {
    eventId: `${order.refId || order._id}-${Date.now()}`,
    orderId: order._id?.toString?.() || null,
    refId: order.refId || null,
    portalId: getPortalIdString(order.portalId || order.portal) || null,
    superDispatchGuid: order.tms?.guid || null,
    purchaseOrderNumber: order.reg || null,
    status: order.tms?.status || order.status || null,
    pickup: {
      scheduledAt: sanitizeDate(schedule.pickupSelected),
      scheduledEndsAt: sanitizeDate(schedule.pickupEstimated?.[1]),
      firstAvailable: sanitizeDate(schedule.pickupEstimated?.[0]),
      customerScheduledAt: sanitizeDate(schedule.pickupSelected),
      actualAt: sanitizeDate(schedule.pickupCompleted),
    },
    delivery: {
      scheduledAt: sanitizeDate(schedule.deliveryEstimated?.[0]),
      scheduledEndsAt: sanitizeDate(schedule.deliveryEstimated?.[1]),
      customerScheduledAt: sanitizeDate(schedule.deliveryEstimated?.[0]),
      actualAt: sanitizeDate(schedule.deliveryCompleted),
    },
  };
};

/**
 * Normalize URL
 */
const normalizeUrl = (path: string): string | null => {
  try {
    const base = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
    const url = new URL(path.replace(/^\//, ""), base);
    return url.toString();
  } catch (error) {
    logger.error("acertusClient: Failed to normalize URL", {
      path,
      baseUrl: BASE_URL,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Build pickup address
 */
const buildPickupAddress = (order: any) => {
  const pickup = order.origin || {};
  return {
    name: pickup.contact?.companyName || pickup.contact?.name || null,
    identifier: pickup.identifier || "",
    dealer_code: pickup.dealer_code || "",
    splc: pickup.splc || "",
    line1: pickup.address?.address || null,
    city: pickup.address?.city || null,
    state: pickup.address?.state || null,
    zip: pickup.address?.zip || null,
  };
};

/**
 * Build delivery address
 */
const buildDeliveryAddress = (order: any) => {
  const delivery = order.destination || {};
  return {
    name: delivery.contact?.companyName || delivery.contact?.name || null,
    identifier: delivery.identifier || "",
    dealer_code: delivery.dealer_code || "",
    splc: delivery.splc || "",
    line1: delivery.address?.address || null,
    city: delivery.address?.city || null,
    state: delivery.address?.state || null,
    zip: delivery.address?.zip || null,
  };
};

/**
 * Build contact payload
 */
const buildContactPayload = ({ name, phone, email }: any) =>
  removeNullish({
    name: name || null,
    phone: phone || null,
    email: email || null,
  });

/**
 * Build pickup details
 */
const buildPickupDetails = (order: any) => {
  const pickup = order.origin || {};
  const schedule = order.schedule || {};

  return removeNullish({
    scheduled_at: sanitizeDate(
      schedule.pickupSelected || schedule.pickupEstimated?.[0],
    ),
    scheduled_ends_at: sanitizeDate(schedule.pickupEstimated?.[1] || null),
    first_available_at: sanitizeDate(schedule.pickupEstimated?.[0] || null),
    address: buildPickupAddress(order),
    contact: buildContactPayload({
      name: pickup.contact?.name || pickup.contact?.companyName || null,
      phone: pickup.contact?.phone || pickup.contact?.phoneMobile || null,
      email: pickup.contact?.email || null,
    }),
    notes: pickup.notes || null,
  });
};

/**
 * Build delivery details
 */
const buildDeliveryDetails = (order: any) => {
  const delivery = order.destination || {};
  const schedule = order.schedule || {};

  return removeNullish({
    scheduled_at: sanitizeDate(schedule.deliveryEstimated?.[0] || null),
    scheduled_ends_at: sanitizeDate(schedule.deliveryEstimated?.[1] || null),
    address: buildDeliveryAddress(order),
    contact: buildContactPayload({
      name: delivery.contact?.name || delivery.contact?.companyName || null,
      phone: delivery.contact?.phone || delivery.contact?.phoneMobile || null,
      email: delivery.contact?.email || null,
    }),
    notes: delivery.notes || null,
  });
};

/**
 * Build vehicle create payload
 */
const buildVehicleCreatePayload = (order: any, vehicle: any, index: number) => {
  const pickup = order.origin || {};
  const delivery = order.destination || {};
  const schedule = order.schedule || {};

  return removeNullish({
    vin: vehicle.vin || null,
    year: vehicle.year || null,
    make: vehicle.make || null,
    model: vehicle.model || null,
    notes: vehicle.notes || null,
    category: vehicle.pricingClass || null,
    order_number: order.refId || null,
    connect_uid:
      vehicle.connect_uid || `${VEHICLE_CONNECT_UID_PREFIX}-${index}`,
    ship_by: sanitizeDate(schedule.pickupSelected || schedule.pickupEstimated?.[0]) || null,
    deliver_by: sanitizeDate(schedule.deliveryEstimated?.[0]) || null,
    pickup_eta: sanitizeDate(schedule.pickupEstimated?.[0]) || null,
    delivery_eta: sanitizeDate(schedule.deliveryEstimated?.[0]) || null,
    origin: removeNullish({
      name: pickup.contact?.companyName || pickup.contact?.name || null,
      email: pickup.contact?.email || order.customer?.email || null,
      line1: pickup.address?.address || null,
      line2: pickup.address?.addressLine2 || null,
      city: pickup.address?.city || null,
      state: pickup.address?.state || null,
      zip: pickup.address?.zip || null,
      hours: pickup.hours || null,
      special_instructions: pickup.notes || null,
      identifier: pickup.identifier || "",
      splc: pickup.splc || "",
      ref_key: pickup.ref_key || "autonation",
      dealer_code: pickup.dealer_code || "",
      ramp_code: pickup.ramp_code || "",
      phone:
        pickup.contact?.phone ||
        pickup.contact?.phoneMobile ||
        null,
    }),
    destination: removeNullish({
      name: delivery.contact?.companyName || delivery.contact?.name || null,
      email: delivery.contact?.email || order.customer?.email || null,
      line1: delivery.address?.address || null,
      line2: delivery.address?.addressLine2 || null,
      city: delivery.address?.city || null,
      state: delivery.address?.state || null,
      zip: delivery.address?.zip || null,
      hours: delivery.hours || null,
      special_instructions: delivery.notes || null,
      identifier: delivery.identifier || "",
      splc: delivery.splc || "",
      ref_key: delivery.ref_key || "autonation",
      dealer_code: delivery.dealer_code || "",
      ramp_code: delivery.ramp_code || "",
      phone:
        delivery.contact?.phone ||
        delivery.contact?.phoneMobile ||
        null,
    }),
  });
};

/**
 * Build vehicle payloads for create
 */
const buildVehicleCreatePayloads = (order: any) => {
  if (!order?.vehicles || order.vehicles.length === 0) {
    return [];
  }

  return order.vehicles.map((vehicle: any, index: number) =>
    buildVehicleCreatePayload(order, vehicle, index),
  );
};

/**
 * Build carrier payload
 */
const buildCarrierPayload = (order: any) => {
  const carrier = order.tms?.carrier || {};
  return {
    scac: carrier.scac || DEFAULT_CARRIER_SCAC || "",
    name: carrier.name || DEFAULT_CARRIER_NAME,
    identifier:
      carrier.identifier || DEFAULT_CARRIER_IDENTIFIER || DEFAULT_CARRIER_SCAC,
    driver: {
      name: carrier.driver?.name || order.driver?.name || null,
      identifier: carrier.driver?.identifier || null,
      signature: carrier.driver?.signature || null,
    },
  };
};

/**
 * Build vehicle payload for assign
 */
const buildVehiclePayload = (order: any) => {
  if (!order?.vehicles || order.vehicles.length === 0) {
    return [];
  }

  const pickup = order.origin || {};
  const delivery = order.destination || {};

  return order.vehicles.map((vehicle: any, index: number) => ({
    connect_uid:
      vehicle.connect_uid || `${VEHICLE_CONNECT_UID_PREFIX}-${index}`,
    vin: vehicle.vin || null,
    order_number: order.refId || null,
    location: vehicle.location || null,
    color: vehicle.color || null,
    price: vehicle.pricing?.totalWithCompanyTariffAndCommission || null,
    origin: {
      connect_id: pickup.connect_id || `${VEHICLE_CONNECT_UID_PREFIX}-pickup`,
      name: pickup.contact?.companyName || pickup.contact?.name || null,
      identifier: pickup.identifier || "",
      ref_key: pickup.ref_key || "autonation",
      line1: pickup.address?.address || null,
      city: pickup.address?.city || null,
      state: pickup.address?.state || null,
      zip: pickup.address?.zip || null,
    },
    destination: {
      connect_id:
        delivery.connect_id || `${VEHICLE_CONNECT_UID_PREFIX}-delivery`,
      name: delivery.contact?.companyName || delivery.contact?.name || null,
      identifier: delivery.identifier || "",
      dealer_code: delivery.dealer_code || "",
      ref_key: delivery.ref_key || "autonation",
      splc: delivery.splc || "",
      line1: delivery.address?.address || null,
      city: delivery.address?.city || null,
      state: delivery.address?.state || null,
      zip: delivery.address?.zip || null,
    },
  }));
};

/**
 * Build load base
 */
const buildLoadBase = (order: any) => ({
  connect_uid: CONNECT_UID || order.refId || null,
  number: order.refId || null,
  carrier: buildCarrierPayload(order),
  vehicles: buildVehiclePayload(order),
  total: order.totalPricing?.totalWithCompanyTariffAndCommission || null,
});

/**
 * Build assign payload
 */
const buildAssignPayload = (order: any) =>
  removeNullish({
    load: {
      ...buildLoadBase(order),
      assigned_at:
        sanitizeDate(order.bookedAt || order.createdAt) ||
        new Date().toISOString(),
      reference_number: order.refId || null,
      purchase_order_number: order.reg || null,
      status: order.tms?.status || order.status || null,
      customer: buildContactPayload({
        name: order.customer?.name || null,
        phone: order.customer?.phone || order.customer?.phoneMobile || null,
        email: order.customer?.email || null,
      }),
      pickup: buildPickupDetails(order),
      delivery: buildDeliveryDetails(order),
      notes: order.customer?.notes || null,
    },
  });

/**
 * Send to endpoint
 */
const sendToEndpoint = async (
  path: string,
  body: any,
  eventType: string,
  order: any,
): Promise<boolean> => {
  const url = normalizeUrl(path);

  if (!url) {
    logger.error("acertusClient: Cannot send update, invalid URL", {
      path,
      eventType,
      payload: body,
    });
    return false;
  }

  const headers: any = {
    "Content-Type": "application/json",
  };

  if (API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`;
  }

  try {
    await axios.post(url, body, {
      headers,
      timeout: DEFAULT_TIMEOUT_MS,
    });
    logger.info("acertusClient: Successfully sent vehichaul update", {
      eventType,
      refId: order.refId,
      sdGuid: order.tms?.guid,
      url,
    });
    return true;
  } catch (error) {
    logger.error("acertusClient: Failed vehichaul update", {
      eventType,
      refId: order.refId,
      sdGuid: order.tms?.guid,
      url,
      error: error instanceof Error ? error.message : String(error),
      status: (error as any).response?.status,
      data: (error as any).response?.data,
    });
  }

  return false;
};

/**
 * Build pickup payload
 */
const buildPickupPayload = (order: any, { eta, gps = null, remarks = null }: any = {}) => ({
  load: {
    ...buildLoadBase(order),
    pickup: {
      eta:
        sanitizeDate(eta) ||
        sanitizeDate(order.schedule?.pickupSelected) ||
        sanitizeDate(order.schedule?.pickupEstimated?.[0]) ||
        null,
      gps,
      remarks,
      address: buildPickupAddress(order),
    },
  },
});

/**
 * Build delivery payload
 */
const buildDeliveryPayload = (order: any, { eta, gps = null, remarks = null }: any = {}) => ({
  load: {
    ...buildLoadBase(order),
    delivery: {
      eta:
        sanitizeDate(eta) ||
        sanitizeDate(order.schedule?.deliveryEstimated?.[0]) ||
        null,
      gps,
      remarks,
      address: buildDeliveryAddress(order),
    },
  },
});

/**
 * Send pickup ETA
 */
export const sendPickupEta = async (order: any, options: any = {}): Promise<void> => {
  if (!isAcertusEnabled()) {
    logger.debug("acertusClient: Acertus integration disabled, skipping sendPickupEta");
    return;
  }

  if (!isAutonationPortal(order)) {
    return;
  }

  const payload = buildPickupPayload(order, options);
  await sendToEndpoint(PICKUP_PATH, payload, "pickup_eta", order);
};

/**
 * Send delivery ETA
 */
export const sendDeliveryEta = async (order: any, options: any = {}): Promise<void> => {
  if (!isAcertusEnabled()) {
    logger.debug("acertusClient: Acertus integration disabled, skipping sendDeliveryEta");
    return;
  }

  if (!isAutonationPortal(order)) {
    return;
  }

  const payload = buildDeliveryPayload(order, options);
  await sendToEndpoint(DELIVERY_PATH, payload, "delivery_eta", order);
};

/**
 * Send vehicle assign
 */
export const sendVehicleAssign = async (order: any): Promise<boolean> => {
  if (!isAcertusEnabled()) {
    logger.debug("acertusClient: Acertus integration disabled, skipping sendVehicleAssign");
    return false;
  }

  if (!isAutonationPortal(order)) {
    return false;
  }

  const payload = buildAssignPayload(order);
  return sendToEndpoint(ASSIGN_PATH, payload, "load_assign", order);
};

/**
 * Send vehicle create - Creates vehicles in Acertus
 */
export const sendVehicleCreate = async (order: any): Promise<Array<{ payload: any; success: boolean }>> => {
  if (!isAutonationPortal(order)) {
    return [];
  }

  const vehiclePayloads = buildVehicleCreatePayloads(order);

  if (vehiclePayloads.length === 0) {
    logger.warn("acertusClient: No vehicles found for create payload", {
      refId: order.refId,
      sdGuid: order.tms?.guid,
    });
    return [];
  }

  const results = [];

  for (const payload of vehiclePayloads) {
    const success = await sendToEndpoint(
      CUSTOMER_VEHICLE_PATH,
      payload,
      "customer_vehicle_create",
      order,
    );
    results.push({ payload, success });
  }

  return results;
};

/**
 * Send update to Acertus API endpoint
 */
const sendUpdate = async (eventType: string, order: any, details: any = {}): Promise<void> => {
  if (!isAutonationPortal(order)) {
    return;
  }

  if (!API_ENDPOINT) {
    logger.warn(
      "acertusClient: ACERTUS_API_URL is not configured, skipping update",
      { eventType },
    );
    return;
  }

  const payload = {
    ...buildBasePayload(order),
    eventType,
    sentAt: new Date().toISOString(),
    details,
  };

  const headers: any = {
    "Content-Type": "application/json",
  };

  if (API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`;
  }

  try {
    await axios.post(API_ENDPOINT, payload, {
      headers,
      timeout: DEFAULT_TIMEOUT_MS,
    });
    logger.info("acertusClient: Successfully sent update", {
      eventType,
      refId: order.refId,
      sdGuid: order.tms?.guid,
    });
  } catch (error) {
    logger.error("acertusClient: Failed to send update", {
      eventType,
      refId: order.refId,
      sdGuid: order.tms?.guid,
      error: error instanceof Error ? error.message : String(error),
      status: (error as any).response?.status,
      data: (error as any).response?.data,
    });
  }
};

/**
 * Notify order created
 */
export const notifyOrderCreated = async (order: any): Promise<void> => {
  if (!isAutonationPortal(order)) {
    return;
  }

  await sendUpdate("order_created", order, {
    source: "autovista-api",
  });

  await Promise.all([sendPickupEta(order), sendDeliveryEta(order)]);
};

/**
 * Notify order picked up
 */
export const notifyOrderPickedUp = async (order: any): Promise<void> => {
  if (!isAutonationPortal(order)) {
    return;
  }

  const actualDate =
    order.schedule?.pickupCompleted ||
    order.schedule?.pickupSelected ||
    order.schedule?.pickupEstimated?.[0] ||
    new Date();

  await Promise.all([
    sendUpdate("order_picked_up", order, {
      pickupActualAt: sanitizeDate(actualDate),
    }),
    sendPickupEta(order, { eta: actualDate }),
  ]);
};

/**
 * Notify order delivered
 */
export const notifyOrderDelivered = async (order: any): Promise<void> => {
  if (!isAutonationPortal(order)) {
    return;
  }

  const actualDate =
    order.schedule?.deliveryCompleted ||
    order.schedule?.deliveryEstimated?.[0] ||
    new Date();

  await Promise.all([
    sendUpdate("order_delivered", order, {
      deliveryActualAt: sanitizeDate(actualDate),
    }),
    sendDeliveryEta(order, { eta: actualDate }),
  ]);
};

/**
 * Notify order schedule updated
 */
export const notifyOrderScheduleUpdated = async (
  order: any,
  { pickupDatesChanged = false, deliveryDatesChanged = false }: any = {},
): Promise<void> => {
  if (!isAutonationPortal(order)) {
    return;
  }

  const tasks = [
    sendUpdate("order_schedule_updated", order, {
      pickupDatesChanged,
      deliveryDatesChanged,
    }),
  ];

  if (pickupDatesChanged) {
    tasks.push(
      sendPickupEta(order, {
        eta:
          order.schedule?.pickupSelected ||
          order.schedule?.pickupEstimated?.[0] ||
          new Date(),
      }),
    );
  }

  if (deliveryDatesChanged) {
    tasks.push(
      sendDeliveryEta(order, {
        eta: order.schedule?.deliveryEstimated?.[0] || new Date(),
      }),
    );
  }

  await Promise.all(tasks);
};

export { AUTONATION_PORTAL_ID };

