# Automated Notifications (Orders and Quotes)

This doc lists the order and quote notifications that are sent automatically, plus pickup/delivery notifications sent via cron. It also notes where each trigger lives and the template used.

## Order notifications (automatic)

### Order creation
- **Agent order confirmation**
  - Trigger: `POST /api/v1/order` (also `POST /api/v1/order/customer` via `createOrder`)
  - Conditions: `isCustomerPortal` is false, portal is not in `MMI_PORTALS`, and `portal.disableAgentNotifications !== true`
  - Recipients: `order.agents` with email addresses
  - Implementation: `src/order/controllers/createOrder.ts` → `sendOrderAgentEmail` (`src/order/notifications/sendOrderAgent.ts`)
  - Template: `src/templates/order-agent.hbs`
  - Notification type stored: `agentsConfirmation`
  - Notes: MMI portals do not receive this; they receive Agents Order Confirmation with Pricing only (below).

- **Customer order confirmation**
  - Trigger: `POST /api/v1/order` and `POST /api/v1/order/customer`
  - Conditions: `order.customer.email` exists
  - Recipients: customer email on the order
  - Implementation: `src/order/controllers/createOrder.ts` → `sendOrderCustomerPublicNew` (`src/order/notifications/sendOrderCustomerPublicNew.ts`)
  - Templates: `src/templates/customer-order-new.hbs` or `src/templates/customer-order-sirva.hbs` (Sirva portals)
  - Notes: Uses EmailTemplate `"Customer Order"`; includes COD payment instructions if `paymentType === "COD"`.

- **White glove order notification (CSR team)**
  - Trigger: `POST /api/v1/order`
  - Conditions: `transportType === WhiteGlove`
  - Recipients: `autologistics.csr@mccollisters.com`
  - Implementation: `src/order/controllers/createOrder.ts` → `sendWhiteGloveNotification` (`src/order/notifications/sendWhiteGloveNotification.ts`)
  - Template: `src/templates/white-glove.hbs`

- **Agents Order Confirmation with Pricing**
  - Trigger: `POST /api/v1/order` (automatic for MMI portals); also available manually via `POST /api/v1/notifications/send` with `emailType: "Agents Order Confirmation with Pricing"`.
  - Conditions (automatic): `portalId` is in `MMI_PORTALS`
  - Recipients (automatic): `autodesk@graebel.com` (passed by controller). Manual: recipients from request body.
  - Implementation: `src/order/controllers/createOrder.ts` → `sendMMIOrderNotification` (`src/order/notifications/sendMMIOrderNotification.ts`)
  - Template: `src/templates/mmi-order-notification.hbs`
  - Notes: This is the only order confirmation MMI agents receive (includes order total and vehicle pricing). Can be sent manually from the app for any order.

### Track order requests
- **Customer confirmation of tracking request**
  - Trigger: `POST /api/v1/order/:orderId/track` or `POST /api/v1/order/:orderId/location`
  - Recipients: `order.customer.email` (fallback in code: `anna@periscopeatlantic.com`)
  - Implementation: `src/order/controllers/requestTrackOrder.ts` and `src/order/controllers/requestDriverLocation.ts`
  - Template: `src/templates/track-order-confirmation.hbs`
  - Notes: Uses EmailTemplate `"Track Order Confirmation"`.

- **Internal tracking notification**
  - Trigger: `POST /api/v1/order/:orderId/track` or `POST /api/v1/order/:orderId/location`
  - Recipients: `autologistics@mccollisters.com` by default
  - Implementation: `src/order/controllers/requestTrackOrder.ts` and `src/order/controllers/requestDriverLocation.ts`
  - Template: `src/templates/track-order-notification.hbs`

## Survey notifications (cron)

### Cron schedule
- Trigger: `initializeCronJobs` in `src/core/cron.ts`
- Schedule: `0 8 * * *` (8:00 daily, America/New_York)
- Conditions: `NODE_ENV === "production"`

### Logic
- **All orders (including MMI):** Standard survey **48 hours after delivered**. Eligibility: `tms.status` in `delivered`/`invoiced`, `tms.updatedAt` between 48 and 72 hours ago, customer has email, `notifications.survey.sentAt` not set. Sends "We're Listening. How did we do?" via `sendSurvey` → `src/templates/survey.hbs`. Updates `notifications.survey`.
- **MMI portals (MMI_PORTALS: MMI_1, MMI_2) additionally:** Pre-survey notification **the day of delivery**. Eligibility: same status/email, `tms.updatedAt` in the last 24 hours, `notifications.surveyReminder.sentAt` not set, `portalId` in `MMI_PORTALS`. Sends "McCollister's Values your Opinion" via `sendPreSurveyNotificationMmi` → `src/templates/mmi-pre-survey-notification.hbs`. Updates `notifications.surveyReminder`. MMI thus receives both the pre-survey (day of delivery) and the standard survey (48h later).

Implementation: `src/order/tasks/sendSurveyNotifications.ts`, `src/order/notifications/sendSurvey.ts`, `src/order/notifications/sendPreSurveyNotificationMmi.ts`.

## Pickup and delivery notifications (cron)

### Cron schedule
- Trigger: `initializeCronJobs` in `src/core/cron.ts`
- Schedule: `0 8,10,12,14,16,18 * * *` (America/New_York)
- Conditions:
  - `ENABLE_NOTIFICATION_CRON === "true"`
  - `NODE_ENV === "production"`

### Pickup confirmations
- Trigger: `sendPickupDeliveryNotifications` → `sendPickupNotificationsForOrder`
- Order filters:
  - `notifications.awaitingPickupConfirmation === true`
  - `updatedAt > NOTIFICATION_CUTOFF_DATE` (default `2024-05-20`)
  - Status must be `picked_up` (skips if `invoiced` or status mismatch unless `preserveFlags` is used)
- Recipients:
  - Portal notification emails where `pickup === true`
  - MMI portals override recipient list to `autodeskupdates@graebel.com`
  - Sirva portals filter by `sirvadomestic`/`sirvanondomestic`
  - Agent emails where `agent.pickup` (or related flags) is true, excluding duplicates already sent to the portal list
- Implementation:
  - `src/order/tasks/sendPickupDeliveryNotifications.ts`
  - `src/order/notifications/sendOrderPickupConfirmation.ts`
- Template: `src/templates/order-pickup.hbs`
- Notification type stored: `agentsPickupConfirmation`

### Delivery confirmations
- Trigger: `sendPickupDeliveryNotifications` → `sendDeliveryNotificationsForOrder`
- Order filters:
  - `notifications.awaitingDeliveryConfirmation === true`
  - `updatedAt > NOTIFICATION_CUTOFF_DATE` (default `2024-05-20`)
  - Status must be `delivered` or `invoiced` unless `preserveFlags` is used
- Recipients:
  - Portal notification emails where `delivery === true`
  - MMI portals override recipient list to `autodeskupdates@graebel.com`
  - Sirva portals filter by `sirvadomestic`/`sirvanondomestic`
  - Agent emails where `agent.delivery` (or related flags) is true, excluding duplicates already sent to the portal list
- Implementation:
  - `src/order/tasks/sendPickupDeliveryNotifications.ts`
  - `src/order/notifications/sendOrderDeliveryConfirmation.ts`
- Template: `src/templates/order-delivery.hbs`
- Notification type stored: `agentsDeliveryConfirmation`

## Quote notifications (automatic)

There are currently **no automated quote emails**. The customer quote email is marked as a TODO in `src/quote/controllers/createQuoteCustomer.ts`, and quote templates exist but are not wired to any controller or cron job:

- `src/templates/customer-quote.hbs`
- `src/templates/mmi-quote-notification.hbs`

## Note on manual triggering (existing)

There is already a manual email endpoint at `POST /api/v1/notifications/send` (`src/notification/routes.ts`, `src/notification/sendManualEmail.ts`) that can trigger several order-related notifications (agent, customer confirmation, pickup/delivery, white glove, MMI, track order, signature, survey). It does not currently send quote emails because no quote email service is implemented yet.
