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
- Trigger: `initializeCronJobs` in `src/core/cron.ts` (called from `src/index.ts` when cron is enabled)
- Schedule: `0 6,10,14,20 * * *` (6:00, 10:00, 14:00, and 20:00 daily, America/New_York)
- Cron is **not** registered when `config.nodeEnv === "staging"` or `DISABLE_CRON_JOBS === "true"` (`src/index.ts`).
- Inside the job, pickup/delivery sends run only when `NODE_ENV === "production"`; otherwise the handler returns without sending.

### Pickup confirmations
- Trigger: `sendPickupDeliveryNotifications` → `sendPickupNotificationsForOrder`
- Order filters (cron query; see `sendPickupDeliveryNotifications`):
  - `notifications.awaitingPickupConfirmation === true`
  - `updatedAt` after the cutoff date (`NOTIFICATION_CUTOFF_DATE` if set and valid; otherwise **rolling 60 days** before “now”)
  - `notifications.agentsPickupConfirmation.sentAt` missing or null
  - Pickup schedule field (`pickupCompleted`, `pickupEstimated.0`, or `pickupSelected`) within the last **48 hours**
- Per-order gates in `sendPickupNotificationsForOrder`: status must be `picked_up` (special case skips `invoiced` unless `preserveFlags`); pickup event time must fall within the last 48 hours unless `preserveFlags` is used.
- **Recipients (single send, merged list):**
  - **Order agents** on the order who want pickup notifications (`pickup`, `enablePickupNotifications`, or `emailPickUp`).
  - **Plus** portal addresses from `portal.notificationEmails` (or legacy `portal.emails`) where `pickup === true`, after Sirva domestic/non-domestic filtering when applicable.
  - **MMI portals** (`MMI_PORTALS`): the portal side of the list is overridden to `autodeskupdates@graebel.com`; agents on the order are still included if they qualify.
  - Lists are **merged with deduplication** by email (case-insensitive). **Agents are ordered first**, so if the same address appears on both the order and the portal, one email is sent and the agent row wins for casing/name.
- Implementation:
  - `src/order/tasks/sendPickupDeliveryNotifications.ts`
  - `src/order/notifications/sendOrderPickupConfirmation.ts`
- Template: `src/templates/order-pickup.hbs`
- Notification type stored: `agentsPickupConfirmation`

### Delivery confirmations
- Trigger: `sendPickupDeliveryNotifications` → `sendDeliveryNotificationsForOrder`
- Order filters (cron query):
  - `notifications.awaitingDeliveryConfirmation === true`
  - `updatedAt` after the same cutoff as pickup (env or 60-day rolling window)
  - `notifications.agentsDeliveryConfirmation.sentAt` missing or null
  - `deliveryCompleted` or `deliveryEstimated.0` within the last **48 hours**
- Per-order gates: status must be `delivered` or `invoiced` unless `preserveFlags`; delivery event time within last 48 hours unless `preserveFlags`.
- **Recipients (single send, merged list):**
  - **Order agents** who want delivery notifications (`delivery`, `enableDeliveryNotifications`, or `emailDelivery`).
  - **Plus** portal notification emails where `delivery === true`, with the same Sirva and MMI rules as pickup.
  - **Dedupe:** same as pickup (agents first, then portal, one email per address).
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
