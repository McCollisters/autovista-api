/**
 * Webhook Type Definitions
 *
 * This file contains all TypeScript interfaces and types for webhook payloads
 * and responses. It provides strong typing for webhook handlers.
 */

// Base webhook interfaces
export interface IWebhookPayload {
  id: string;
  timestamp: string;
  event: string;
  data: any;
  signature?: string;
  source: string;
}

export interface IWebhookResponse {
  success: boolean;
  message?: string;
  processedAt: string;
  webhookId?: string;
}

// Webhook event types
export type WebhookEventType =
  | "order.created"
  | "order.updated"
  | "order.cancelled"
  | "order.canceled" // Alternative spelling for Super Dispatch
  | "order.delivered" // Super Dispatch order delivered
  | "order.invoiced" // Super Dispatch order invoiced
  | "order.modified" // Super Dispatch order modified
  | "order.picked_up" // Super Dispatch order picked up
  | "order.removed" // Super Dispatch order removed
  | "vehicle.modified" // Super Dispatch vehicle modified
  | "carrier.accepted" // Carrier accepted order
  | "carrier.canceled" // Carrier canceled order
  | "carrier.accepted_by_shipper" // Carrier accepted by shipper (accepted-carrier)
  | "offer.sent" // Offer sent to carrier
  | "quote.created"
  | "quote.updated"
  | "quote.expired"
  | "user.created"
  | "user.updated"
  | "portal.created"
  | "portal.updated"
  | "payment.completed"
  | "payment.failed"
  | "shipment.created"
  | "shipment.updated"
  | "shipment.delivered";

// Webhook source types
export type WebhookSource =
  | "superdispatch"
  | "carrier"
  | "stripe"
  | "paypal"
  | "internal"
  | "external_portal"
  | "tms_system";

// Super Dispatch order cancelled payload (matches old API structure)
export interface ISuperDispatchOrderCancelledPayload {
  order_guid: string;
  // Add other fields as needed based on actual Super Dispatch payload
}

// Super Dispatch order delivered payload (matches old API structure)
export interface ISuperDispatchOrderDeliveredPayload {
  order_guid: string;
  // Add other fields as needed based on actual Super Dispatch payload
}

// Super Dispatch order invoiced payload (matches old API structure)
export interface ISuperDispatchOrderInvoicedPayload {
  order_guid: string;
  // Add other fields as needed based on actual Super Dispatch payload
}

// Super Dispatch order modified payload (matches old API structure)
export interface ISuperDispatchOrderModifiedPayload {
  order_guid: string;
  // Add other fields as needed based on actual Super Dispatch payload
}

// Super Dispatch order picked up payload (matches old API structure)
export interface ISuperDispatchOrderPickedUpPayload {
  order_guid: string;
  // Add other fields as needed based on actual Super Dispatch payload
}

// Super Dispatch vehicle modified payload (matches old API structure)
export interface ISuperDispatchVehicleModifiedPayload {
  order_guid: string;
  // Add other fields as needed based on actual Super Dispatch payload
}

// Carrier accepted payload (matches old API structure)
export interface ICarrierAcceptedPayload {
  order_guid: string;
  carrier_guid: string;
  // Add other fields as needed based on actual carrier webhook payload
}

// Carrier canceled payload (matches old API structure)
export interface ICarrierCanceledPayload {
  order_guid: string;
  carrier_guid: string;
  carrier_name?: string;
  carrier_email?: string;
  // Add other fields as needed based on actual carrier webhook payload
}

// Super Dispatch order removed payload
export interface ISuperDispatchOrderRemovedPayload {
  order_guid: string;
  // Add other fields as needed based on actual Super Dispatch payload
}

// Carrier accepted by shipper payload (accepted-carrier webhook)
export interface ICarrierAcceptedByShipperPayload {
  order_guid: string;
  carrier_guid: string;
  // Add other fields as needed based on actual webhook payload
}

// Offer sent to carrier payload
export interface IOfferSentPayload {
  order_guid: string;
  carrier_guid: string;
  carrier_name?: string;
  // Add other fields as needed based on actual webhook payload
}

// Super Dispatch order modified payload with detailed modification data
export interface ISuperDispatchOrderModifiedDetailedPayload
  extends ISuperDispatchOrderModifiedPayload {
  action_date?: string;
  user_guid?: string;
  data?: {
    purchase_order_number?: {
      old_value?: string;
      new_value?: string;
    };
    price?: {
      old_value?: number;
      new_value?: number;
    };
    pickup?: {
      scheduled_at?: { new_value?: string };
      scheduled_ends_at?: { new_value?: string };
      first_available_pickup_date?: { new_value?: string };
      scheduled_at_by_customer?: { new_value?: string };
      notes?: { new_value?: string };
      venue?: {
        name?: { new_value?: string };
        business_type?: { new_value?: string };
        contact_phone?: { new_value?: string };
        contact_mobile_phone?: { new_value?: string };
        contact_name?: { new_value?: string };
      };
    };
    delivery?: {
      scheduled_at?: { new_value?: string };
      scheduled_ends_at?: { new_value?: string };
      scheduled_at_by_customer?: { new_value?: string };
      notes?: { new_value?: string };
      venue?: {
        name?: { new_value?: string };
        business_type?: { new_value?: string };
        contact_phone?: { new_value?: string };
        contact_mobile_phone?: { new_value?: string };
        contact_name?: { new_value?: string };
      };
    };
  };
}

// Webhook handler function type
export type WebhookHandler<T = any> = (
  payload: T,
  headers: Record<string, string>,
) => Promise<IWebhookResponse>;

// Webhook configuration
export interface IWebhookConfig {
  enabled: boolean;
  secret?: string;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

// Webhook registry entry
export interface IWebhookRegistryEntry {
  event: WebhookEventType;
  source: WebhookSource;
  handler: WebhookHandler;
  config: IWebhookConfig;
}
