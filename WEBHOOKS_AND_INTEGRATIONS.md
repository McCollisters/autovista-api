# Webhooks and Integrations Guide

This guide explains the webhook system and how data flows from Super Dispatch through the Autovista API to Acertus (Vehichaul) for Autonation portal orders.

## Table of Contents

1. [Overview](#overview)
2. [Webhook System Architecture](#webhook-system-architecture)
3. [Super Dispatch Integration](#super-dispatch-integration)
4. [Data Flow: Super Dispatch → Acertus](#data-flow-super-dispatch--acertus)
5. [Acertus Integration](#acertus-integration)
6. [Webhook Events and Handlers](#webhook-events-and-handlers)
7. [Configuration](#configuration)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Autovista API integrates with multiple external systems:

- **Super Dispatch**: Transportation Management System (TMS) that manages order execution and carrier coordination
- **Acertus (Vehichaul)**: Vehicle logistics platform used specifically for Autonation portal orders
- **Miles Accounting**: Accounting software that receives delivery confirmations

The system uses a webhook-based architecture where Super Dispatch sends real-time event notifications, which are processed and then forwarded to Acertus for Autonation portal orders.

---

## Webhook System Architecture

### Webhook Registration

The webhook system is initialized at server startup in `src/_global/integrations/webhooks/index.ts`. Each webhook event is registered with:

- **Event Type**: The specific event (e.g., `order.picked_up`, `order.delivered`)
- **Source**: The origin system (e.g., `superdispatch`, `carrier`)
- **Handler Function**: The function that processes the webhook
- **Configuration**: Rate limiting, retry policies, and enabled/disabled status

### Webhook Endpoints

The API exposes webhook endpoints at:

- **Primary Endpoint**: `POST /api/v1/webhooks/superdispatch`
  - Handles all Super Dispatch webhook events
  - Automatically determines event type from payload structure

- **Legacy Callback Routes** (for backward compatibility): `POST /callback/*`
  - `/callback/order-cancel`
  - `/callback/order-picked-up`
  - `/callback/order-delivered`
  - `/callback/order-invoiced`
  - `/callback/order-removed`
  - `/callback/order-modified`
  - `/callback/vehicle-modified`
  - `/callback/accepted-carrier`
  - `/callback/carrier-accepted`
  - `/callback/carrier-canceled`
  - `/callback/offer-sent`
  - `/callback/vehicle-haul`

### Webhook Processing Flow

```
Super Dispatch Webhook
    ↓
POST /api/v1/webhooks/superdispatch
    ↓
Event Type Detection (registry.ts)
    ↓
Find Registered Handler
    ↓
Immediate 200 Response (to avoid timeout)
    ↓
Asynchronous Processing
    ↓
Handler Function Execution
    ↓
Order Update in Database
    ↓
(If Autonation Portal) → Acertus Notification
```

### Key Files

- `src/_global/integrations/webhooks/registry.ts` - Webhook router and event routing
- `src/_global/integrations/webhooks/handlers.ts` - Handler implementations
- `src/_global/integrations/webhooks/types.ts` - TypeScript type definitions
- `src/_global/integrations/webhooks/index.ts` - Webhook registration

---

## Super Dispatch Integration

### Sending Orders to Super Dispatch

When an order is created and needs to be sent to Super Dispatch:

**File**: `src/order/integrations/sendOrderToSuper.ts`

**Process**:
1. Order data is formatted according to Super Dispatch API specification
2. Vehicles, pickup/delivery locations, and customer information are structured
3. POST request sent to `{SUPERDISPATCH_API_URL}/orders`
4. Super Dispatch returns a `guid` which is stored in `order.tms.guid`

**Order Format**:
```json
{
  "number": "uniqueId",
  "purchase_order_number": "reg",
  "pickup": {
    "first_available_pickup_date": "YYYY-MM-DD",
    "scheduled_at": "YYYY-MM-DD",
    "scheduled_ends_at": "YYYY-MM-DD",
    "venue": { ... }
  },
  "delivery": { ... },
  "customer": { ... },
  "vehicles": [ ... ],
  "transport_type": "ENCLOSED" | "OPEN"
}
```

### Receiving Webhooks from Super Dispatch

Super Dispatch sends webhooks whenever an order status changes. The API processes these asynchronously to avoid timeouts.

---

## Data Flow: Super Dispatch → Acertus

This section details the complete data flow for Autonation portal orders.

### 1. Order Creation and Initial Send

**Flow**:
```
Order Created in Autovista API
    ↓
Check if Portal = Autonation Portal ID
    ↓
Send Order to Super Dispatch
    ↓
Store Super Dispatch GUID (order.tms.guid)
    ↓
(If Autonation) Send Vehicle Create to Acertus
    ↓
(If Autonation) Send Initial Pickup/Delivery ETAs to Acertus
```

**Files Involved**:
- `src/order/integrations/sendOrderToSuper.ts` - Send to Super Dispatch
- `src/order/integrations/acertusClient.ts` - Send to Acertus
  - `sendVehicleCreate()` - Creates vehicles in Acertus
  - `notifyOrderCreated()` - Sends initial order notification and ETAs

### 2. Order Picked Up Event

**Flow**:
```
Super Dispatch detects order pickup
    ↓
Super Dispatch sends webhook: POST /api/v1/webhooks/superdispatch
Payload: { "order_guid": "...", "status": "picked_up" }
    ↓
Event type detected: "order.picked_up"
    ↓
Handler: handleSuperDispatchOrderPickedUp()
    ↓
Find order by tms.guid
    ↓
Update order status:
  - order.tms.status = "picked_up"
  - order.tms.updatedAt = new Date()
    ↓
Save order to database
    ↓
(If Autonation Portal) → notifyOrderPickedUp()
    ↓
Acertus receives:
  - Order update notification
  - Pickup ETA with actual date
```

**Files Involved**:
- `src/_global/integrations/webhooks/handlers.ts`
  - `handleSuperDispatchOrderPickedUp()` - Updates order status
- `src/order/integrations/acertusClient.ts`
  - `notifyOrderPickedUp()` - Sends update to Acertus
  - `sendUpdate()` - Generic update sender
  - `sendPickupEta()` - Sends pickup ETA

**Current Status**: The webhook handler currently updates the order status but does not automatically call Acertus. To complete the integration, add the following to `handleSuperDispatchOrderPickedUp`:

```typescript
// After order.save()
if (isAutonationPortal(order)) {
  const { notifyOrderPickedUp } = await import("@/order/integrations/acertusClient");
  await notifyOrderPickedUp(order).catch((error) => {
    logger.error("Failed to notify Acertus of order pickup", {
      orderId: order._id,
      error: error.message,
    });
  });
}
```

### 3. Order Delivered Event

**Flow**:
```
Super Dispatch detects order delivery
    ↓
Super Dispatch sends webhook: POST /api/v1/webhooks/superdispatch
Payload: { "order_guid": "...", "status": "delivered" }
    ↓
Event type detected: "order.delivered"
    ↓
Handler: handleSuperDispatchOrderDelivered()
    ↓
Send update to Miles accounting software
    ↓
Find order by tms.guid
    ↓
Update order status:
  - order.status = Status.Complete
  - order.tms.status = "delivered"
  - order.tms.updatedAt = new Date()
    ↓
Save order to database
    ↓
(If Autonation Portal) → notifyOrderDelivered()
    ↓
Acertus receives:
  - Order delivered notification
  - Delivery ETA with actual date
```

**Files Involved**:
- `src/_global/integrations/webhooks/handlers.ts`
  - `handleSuperDispatchOrderDelivered()` - Updates order and sends to Miles
- `src/order/integrations/acertusClient.ts`
  - `notifyOrderDelivered()` - Sends update to Acertus

**Current Status**: Similar to picked up event, the handler updates order status but doesn't automatically call Acertus. Add similar integration code.

### 4. Order Modified Event

**Flow**:
```
Super Dispatch detects order modification
    ↓
Super Dispatch sends webhook
Payload: { "order_guid": "...", "status": "modified" }
    ↓
Handler: handleSuperDispatchOrderModified()
    ↓
Update order.tms.updatedAt timestamp
    ↓
Save order
```

Note: Order modifications typically don't require Acertus updates unless schedule changes are detected.

### 5. Carrier Accepted Event

**Flow**:
```
Carrier accepts order in Super Dispatch
    ↓
Webhook: "carrier.accepted" or "carrier.accepted_by_shipper"
    ↓
Handler: handleCarrierAccepted() or handleCarrierAcceptedByShipper()
    ↓
Find/Create carrier record
    ↓
If order was partial (tmsPartialOrder = true):
    ↓
Release full order details to Super Dispatch
    ↓
Update order.tmsPartialOrder = false
```

**Files Involved**:
- `src/_global/integrations/webhooks/handlers.ts`
  - `handleCarrierAccepted()`
  - `handleCarrierAcceptedByShipper()`
- `src/order/integrations/updateSuperWithCompleteOrder.ts` - Releases full order details

---

## Acertus Integration

### Overview

Acertus (Vehichaul) is integrated specifically for **Autonation portal orders only**. All Acertus functions check `isAutonationPortal(order)` before processing.

**Autonation Portal ID**: `62b89733d996a00046fe815e` (configurable via `ACERTUS_AUTONATION_PORTAL_ID`)

### Key Functions

#### `notifyOrderCreated(order)`

Called when an order is first created and sent to Super Dispatch.

**What it does**:
1. Sends order creation event to Acertus
2. Sends initial pickup ETA
3. Sends initial delivery ETA

**Endpoint**: `{ACERTUS_API_URL}/api/order-updates`

#### `notifyOrderPickedUp(order)`

Called when an order is picked up (typically from Super Dispatch webhook).

**What it does**:
1. Sends `order_picked_up` event to Acertus
2. Sends pickup ETA update with actual pickup date

**Endpoints**:
- `{ACERTUS_API_URL}/api/order-updates` - Order update
- `{ACERTUS_BASE_URL}/api/connect/broker/vehicle/pickup/eta` - Pickup ETA

#### `notifyOrderDelivered(order)`

Called when an order is delivered (typically from Super Dispatch webhook).

**What it does**:
1. Sends `order_delivered` event to Acertus
2. Sends delivery ETA update with actual delivery date

**Endpoints**:
- `{ACERTUS_API_URL}/api/order-updates` - Order update
- `{ACERTUS_BASE_URL}/api/connect/broker/vehicle/delivery/eta` - Delivery ETA

#### `sendVehicleCreate(order)`

Creates vehicles in Acertus system. Called separately from order creation.

**Endpoint**: `{ACERTUS_BASE_URL}/api/connect/customer/vehicle`

**Payload Structure**:
```typescript
{
  vin: string,
  year: string,
  make: string,
  model: string,
  order_number: string,
  connect_uid: string,
  ship_by: ISO_DATE,
  deliver_by: ISO_DATE,
  pickup_eta: ISO_DATE,
  delivery_eta: ISO_DATE,
  origin: { ... },
  destination: { ... }
}
```

#### `sendVehicleAssign(order)`

Assigns vehicles to a load in Acertus.

**Endpoint**: `{ACERTUS_BASE_URL}/api/connect/broker/vehicle/assign`

#### `sendPickupEta(order, options)`

Sends pickup ETA update to Acertus.

**Endpoint**: `{ACERTUS_BASE_URL}/api/connect/broker/vehicle/pickup/eta`

#### `sendDeliveryEta(order, options)`

Sends delivery ETA update to Acertus.

**Endpoint**: `{ACERTUS_BASE_URL}/api/connect/broker/vehicle/delivery/eta`

### Acertus Payload Format

All Acertus payloads follow a consistent structure:

**Base Order Update**:
```json
{
  "eventId": "unique-event-id",
  "orderId": "mongodb-object-id",
  "uniqueId": "order-ref-id",
  "portalId": "portal-id",
  "superDispatchGuid": "super-dispatch-guid",
  "eventType": "order_picked_up",
  "sentAt": "ISO_TIMESTAMP",
  "status": "picked_up",
  "pickup": {
    "scheduledAt": "ISO_DATE",
    "actualAt": "ISO_DATE",
    ...
  },
  "delivery": {
    "scheduledAt": "ISO_DATE",
    "actualAt": "ISO_DATE",
    ...
  }
}
```

**File**: `src/order/integrations/acertusClient.ts`

---

## Webhook Events and Handlers

### Super Dispatch Events

| Event Type | Handler | Description | Acertus Notification |
|------------|---------|-------------|---------------------|
| `order.canceled` | `handleSuperDispatchOrderCancelled` | Order was cancelled | No |
| `order.delivered` | `handleSuperDispatchOrderDelivered` | Order delivered | Yes (if Autonation) |
| `order.invoiced` | `handleSuperDispatchOrderInvoiced` | Order invoiced | No |
| `order.modified` | `handleSuperDispatchOrderModified` | Order modified | No |
| `order.picked_up` | `handleSuperDispatchOrderPickedUp` | Order picked up | Yes (if Autonation) |
| `order.removed` | `handleSuperDispatchOrderRemoved` | Order removed | No |
| `vehicle.modified` | `handleSuperDispatchVehicleModified` | Vehicle modified | No |

### Carrier Events

| Event Type | Handler | Description |
|------------|---------|-------------|
| `carrier.accepted` | `handleCarrierAccepted` | Carrier accepted order |
| `carrier.accepted_by_shipper` | `handleCarrierAcceptedByShipper` | Carrier accepted by shipper |
| `carrier.canceled` | `handleCarrierCanceled` | Carrier canceled order |
| `offer.sent` | `handleOfferSent` | Offer sent to carrier |

### Event Detection Logic

The webhook router automatically detects event types from Super Dispatch payloads:

```typescript
if (rawPayload.order_guid && !rawPayload.status) {
  eventType = "order.canceled";
} else if (rawPayload.status === "delivered") {
  eventType = "order.delivered";
} else if (rawPayload.status === "picked_up") {
  eventType = "order.picked_up";
} else if (rawPayload.status === "modified") {
  eventType = "order.modified";
} else if (rawPayload.type === "vehicle_modified") {
  eventType = "vehicle.modified";
}
```

---

## Configuration

### Environment Variables

#### Super Dispatch

```bash
SUPERDISPATCH_API_URL=https://api.shipper.superdispatch.com/v1/public
SUPERDISPATCH_API_TOKEN=your-api-token
SD_USER=superdispatch-username
SD_PASS=superdispatch-password
```

#### Acertus (Vehichaul)

```bash
ACERTUS_AUTONATION_PORTAL_ID=62b89733d996a00046fe815e
ACERTUS_API_URL=https://mccollistersstaging.vehichaul.com/api/order-updates
ACERTUS_BASE_URL=https://mccollistersstaging.vehichaul.com/
ACERTUS_API_KEY=your-api-key
ACERTUS_CONNECT_UID=your-connect-uid
ACERTUS_CARRIER_NAME=ACERTUS
ACERTUS_CARRIER_SCAC=your-scac
ACERTUS_TIMEOUT_MS=15000
ACERTUS_VEHICLE_CONNECT_UID_PREFIX=autonation
```

### Webhook Configuration

Webhooks are configured in `src/_global/integrations/webhooks/index.ts`:

```typescript
registerWebhook(
  "order.picked_up",
  "superdispatch",
  handleSuperDispatchOrderPickedUp,
  {
    enabled: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
    },
  },
);
```

---

## Troubleshooting

### Webhook Not Received

1. **Check webhook endpoint**: Ensure Super Dispatch is configured to send webhooks to the correct URL
2. **Check logs**: Look for webhook receipt in application logs
3. **Verify authentication**: Ensure webhook endpoint is accessible (may require firewall rules)

### Order Not Found in Webhook Handler

**Symptom**: Handler logs "Order not found for Super Dispatch [event]"

**Cause**: Order `tms.guid` doesn't match the `order_guid` in webhook payload

**Solution**:
1. Verify order was successfully sent to Super Dispatch
2. Check that `order.tms.guid` is stored correctly
3. Verify the `order_guid` in webhook payload matches the stored GUID

### Acertus Not Receiving Updates

**Symptom**: Order updates in Autovista but Acertus doesn't receive notifications

**Causes**:
1. Order is not from Autonation portal (check `order.portalId`)
2. Acertus API credentials are invalid
3. Network/firewall blocking Acertus API calls
4. Handler not calling Acertus notification functions (see Current Status notes above)

**Solution**:
1. Verify `isAutonationPortal(order)` returns true
2. Check Acertus API logs for errors
3. Verify `ACERTUS_API_KEY` and `ACERTUS_API_URL` are correct
4. Ensure webhook handlers call Acertus notification functions

### Webhook Timeout

**Symptom**: Super Dispatch reports webhook failures or timeouts

**Solution**: The API immediately responds with `200 OK` and processes webhooks asynchronously. If timeouts occur:
1. Check server performance and response times
2. Verify webhook endpoint is responding quickly
3. Check for long-running operations in handlers

### Partial Order Release

**Symptom**: Full order details not released to Super Dispatch after carrier acceptance

**Cause**: Order has `tmsPartialOrder = true` and carrier acceptance handler didn't release full details

**Solution**: Handler automatically releases full details on carrier acceptance, but verify:
1. Handler `handleCarrierAccepted` or `handleCarrierAcceptedByShipper` is called
2. `updateSuperWithCompleteOrder` function executes successfully
3. Check logs for errors during full order release

---

## Example Data Flow Scenario

### Complete Order Lifecycle: Autonation Portal Order

1. **Order Creation**
   ```
   User creates order in Autonation portal
   → Order saved in Autovista database
   → Order sent to Super Dispatch (sendOrderToSuper)
   → Super Dispatch returns GUID: "abc123"
   → Order.tms.guid = "abc123"
   → notifyOrderCreated(order)
   → Acertus receives order creation + ETAs
   ```

2. **Order Picked Up**
   ```
   Driver picks up vehicle
   → Super Dispatch detects pickup
   → Webhook: POST /api/v1/webhooks/superdispatch
     { "order_guid": "abc123", "status": "picked_up" }
   → handleSuperDispatchOrderPickedUp()
   → Order.tms.status = "picked_up"
   → notifyOrderPickedUp(order)
   → Acertus receives: order_picked_up event + pickup ETA
   ```

3. **Order Delivered**
   ```
   Driver delivers vehicle
   → Super Dispatch detects delivery
   → Webhook: POST /api/v1/webhooks/superdispatch
     { "order_guid": "abc123", "status": "delivered" }
   → handleSuperDispatchOrderDelivered()
   → Send to Miles accounting
   → Order.status = "Complete"
   → Order.tms.status = "delivered"
   → notifyOrderDelivered(order)
   → Acertus receives: order_delivered event + delivery ETA
   ```

---

## Files Reference

### Core Webhook Files
- `src/_global/integrations/webhooks/index.ts` - Webhook registration
- `src/_global/integrations/webhooks/registry.ts` - Webhook router and routing
- `src/_global/integrations/webhooks/handlers.ts` - Event handlers
- `src/_global/integrations/webhooks/types.ts` - TypeScript types
- `src/_global/integrations/webhooks/callbacks.ts` - Legacy callback routes
- `src/_global/integrations/webhooks/middleware.ts` - Webhook middleware

### Integration Files
- `src/order/integrations/sendOrderToSuper.ts` - Send order to Super Dispatch
- `src/order/integrations/acertusClient.ts` - Acertus integration client
- `src/order/integrations/updateSuperWithCompleteOrder.ts` - Release full order details

### Route Registration
- `src/index.ts` - Main server file (webhook routes registered here)

---

## Future Enhancements

### Recommended Improvements

1. **Automatic Acertus Integration**: Update webhook handlers to automatically call Acertus notification functions for Autonation portal orders

2. **Webhook Retry Mechanism**: Implement retry logic for failed webhook processing

3. **Webhook Verification**: Add webhook signature verification for security

4. **Webhook Status Dashboard**: Create endpoint to view webhook processing status

5. **Order Sync**: Add mechanism to sync order status from Super Dispatch if webhooks are missed

---

## Support

For issues or questions:
1. Check application logs: `logs/combined.log`, `logs/error.log`
2. Review webhook handler logs for specific events
3. Verify environment variables are set correctly
4. Check Super Dispatch and Acertus API status
