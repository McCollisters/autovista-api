# Autovista API

McCollister's Autovista API - A comprehensive vehicle transportation management system built with Node.js, TypeScript, Express, and MongoDB.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Services](#core-services)
  - [Quote Service](#quote-service)
  - [Order Service](#order-service)
  - [Survey Service](#survey-service)
  - [Survey Response Service](#survey-response-service)
- [Integrations](#integrations)
  - [Super Dispatch Integration](#super-dispatch-integration)
  - [Acertus Integration](#acertus-integration)
  - [Webhook System](#webhook-system)
  - [Captivated SMS Integration](#captivated-sms-integration)
- [Supporting Services](#supporting-services)
  - [Authentication Service](#authentication-service)
  - [User Service](#user-service)
  - [Portal Service](#portal-service)
  - [Brand Service](#brand-service)
  - [Modifier Set Service](#modifier-set-service)
  - [Settings Service](#settings-service)
- [Infrastructure Services](#infrastructure-services)
  - [Notification System](#notification-system)
  - [Email Service](#email-service)
  - [Integration Utilities](#integration-utilities)
  - [Cron Jobs](#cron-jobs)
- [API Routes](#api-routes)
- [Database & Models](#database--models)
- [Migrations](#migrations)
- [Testing](#testing)
- [Scripts](#scripts)

---

## Overview

The Autovista API is a full-featured vehicle transportation management platform that handles:

- **Quote Management**: Create, calculate, and manage vehicle transport quotes with dynamic pricing
- **Order Management**: Convert quotes to orders, track shipments, and manage order lifecycle
- **Third-Party Integrations**: Seamless integration with Super Dispatch (TMS), Acertus (Vehichaul), and other services
- **Customer Surveys**: Collect and analyze customer feedback
- **Multi-Portal Support**: Manage multiple customer portals with different configurations
- **Real-time Notifications**: Email and SMS notifications for order updates
- **Webhook System**: Comprehensive webhook support for external integrations

---

## Architecture

The API follows a modular architecture with clear separation of concerns:

```
src/
├── _global/          # Shared utilities, models, integrations
├── quote/            # Quote management service
├── order/            # Order management service
├── survey/           # Survey service
├── surveyResponse/   # Survey response service
├── auth/             # Authentication service
├── user/             # User management service
├── portal/           # Portal management service
├── brand/            # Vehicle brand/make management
├── modifierSet/      # Pricing modifier management
├── settings/         # System settings
├── notification/     # Notification system
├── email/            # Email template management
├── integration/      # Third-party integrations
├── core/             # Core utilities (logger, cron, middleware)
└── presentation/     # Health checks and presentation routes
```

---

## Core Services

### Quote Service

**Location**: [`src/quote/`](src/quote/)

The Quote Service handles vehicle transportation quote creation, calculation, and management.

#### Features

- **Quote Creation**: Create new quotes with vehicle details, origin/destination, and transport preferences
- **Dynamic Pricing**: Calculate quotes based on distance, vehicle class, modifiers, and service levels
- **Multiple Base Rate Sources**: Supports TMS, Custom, and JK base rate integrations
- **Quote Matching**: Match new quotes against existing quotes to prevent duplicates
- **Quote Recalculation**: Recalculate existing quotes with updated parameters
- **Transport Options**: Update transport type (open/enclosed) and service levels
- **Customer Management**: Find and create customers associated with quotes

#### Key Files

- **Routes**: [`src/quote/routes.ts`](src/quote/routes.ts)
- **Schema**: [`src/quote/schema.ts`](src/quote/schema.ts)
- **Controllers**:
  - [`src/quote/controllers/createQuote.ts`](src/quote/controllers/createQuote.ts) - Create new quotes
  - [`src/quote/controllers/getQuote.ts`](src/quote/controllers/getQuote.ts) - Retrieve single quote
  - [`src/quote/controllers/getQuotes.ts`](src/quote/controllers/getQuotes.ts) - List quotes with filtering
  - [`src/quote/controllers/updateQuote.ts`](src/quote/controllers/updateQuote.ts) - Update quote details
  - [`src/quote/controllers/deleteQuote.ts`](src/quote/controllers/deleteQuote.ts) - Delete quotes
  - [`src/quote/controllers/updateTransportOptions.ts`](src/quote/controllers/updateTransportOptions.ts) - Update transport preferences
  - [`src/quote/controllers/findQuoteCustomer.ts`](src/quote/controllers/findQuoteCustomer.ts) - Find customer by email/phone
  - [`src/quote/controllers/createQuoteCustomer.ts`](src/quote/controllers/createQuoteCustomer.ts) - Create new customer
  - [`src/quote/controllers/updateQuoteAlternative.ts`](src/quote/controllers/updateQuoteAlternative.ts) - Update quote alternatives

#### Services

- [`src/quote/services/calculateTotalPricing.ts`](src/quote/services/calculateTotalPricing.ts) - Calculate total pricing for quotes
- [`src/quote/services/getMiles.ts`](src/quote/services/getMiles.ts) - Calculate distance between locations
- [`src/quote/services/matchesExistingQuote.ts`](src/quote/services/matchesExistingQuote.ts) - Check for duplicate quotes
- [`src/quote/services/recalculateExistingQuote.ts`](src/quote/services/recalculateExistingQuote.ts) - Recalculate quote pricing
- [`src/quote/services/updateVehiclesWithPricing.ts`](src/quote/services/updateVehiclesWithPricing.ts) - Update vehicle pricing with modifiers
- [`src/quote/services/validateLocation.ts`](src/quote/services/validateLocation.ts) - Validate origin/destination addresses

#### Integrations

- [`src/quote/integrations/getTMSBaseRate.ts`](src/quote/integrations/getTMSBaseRate.ts) - Fetch base rates from TMS
- [`src/quote/integrations/getCustomBaseRate.ts`](src/quote/integrations/getCustomBaseRate.ts) - Fetch custom base rates
- [`src/quote/integrations/getJKBaseRate.ts`](src/quote/integrations/getJKBaseRate.ts) - Fetch JK base rates

#### API Endpoints

- `GET /api/v1/quotes` - List quotes
- `POST /api/v1/quote` - Create new quote
- `GET /api/v1/quote/:quoteId` - Get single quote
- `PATCH /api/v1/quote/:quoteId` - Update quote
- `DELETE /api/v1/quote/:quoteId` - Delete quote
- `POST /api/v1/quote/transport` - Update transport options
- `POST /api/v1/quote/customer/find` - Find customer
- `POST /api/v1/quote/customer` - Create customer
- `PUT /api/v1/quote` - Update quote alternative

---

### Order Service

**Location**: [`src/order/`](src/order/)

The Order Service manages the complete order lifecycle from creation to delivery, including integration with Super Dispatch and other TMS systems.

#### Features

- **Order Creation**: Convert quotes to orders with full vehicle and customer details
- **Order Tracking**: Track order status, driver location, and delivery updates
- **Super Dispatch Integration**: Send orders to Super Dispatch TMS, receive webhook updates
- **Acertus Integration**: Special handling for Autonation portal orders via Acertus (Vehichaul)
- **File Management**: Upload and manage order-related documents
- **Activity Logging**: Track all order activities and status changes
- **Analytics & Reports**: Generate commission reports and order analytics
- **Export Functionality**: Export orders to CSV format
- **Terms Acceptance**: Track customer acceptance of order terms

#### Key Files

- **Routes**: [`src/order/routes.ts`](src/order/routes.ts)
- **Schema**: [`src/order/schema.ts`](src/order/schema.ts)
- **Controllers**:
  - [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) - Create orders from quotes
  - [`src/order/controllers/getOrder.ts`](src/order/controllers/getOrder.ts) - Retrieve single order
  - [`src/order/controllers/getOrders.ts`](src/order/controllers/getOrders.ts) - List orders with filtering
  - [`src/order/controllers/updateOrder.ts`](src/order/controllers/updateOrder.ts) - Update order details
  - [`src/order/controllers/deleteOrder.ts`](src/order/controllers/deleteOrder.ts) - Delete orders
  - [`src/order/controllers/requestTrackOrder.ts`](src/order/controllers/requestTrackOrder.ts) - Request order tracking
  - [`src/order/controllers/getOrderStatus.ts`](src/order/controllers/getOrderStatus.ts) - Get current order status
  - [`src/order/controllers/requestDriverLocation.ts`](src/order/controllers/requestDriverLocation.ts) - Request driver GPS location
  - [`src/order/controllers/getOrderActivities.ts`](src/order/controllers/getOrderActivities.ts) - Get order activity log
  - [`src/order/controllers/addOrderFiles.ts`](src/order/controllers/addOrderFiles.ts) - Upload order files
  - [`src/order/controllers/removeOrderFile.ts`](src/order/controllers/removeOrderFile.ts) - Remove order files
  - [`src/order/controllers/getCommissionReports.ts`](src/order/controllers/getCommissionReports.ts) - Generate commission reports
  - [`src/order/controllers/exportOrders.ts`](src/order/controllers/exportOrders.ts) - Export orders to CSV
  - [`src/order/controllers/getOrdersAnalytics.ts`](src/order/controllers/getOrdersAnalytics.ts) - Get order analytics
  - [`src/order/controllers/acceptOrderTerms.ts`](src/order/controllers/acceptOrderTerms.ts) - Accept order terms
  - [`src/order/controllers/createOrderCustomer.ts`](src/order/controllers/createOrderCustomer.ts) - Create order customer

#### Services

- [`src/order/services/formatOrderForSD.ts`](src/order/services/formatOrderForSD.ts) - Format order for Super Dispatch API
- [`src/order/services/formatOrderTotalPricing.ts`](src/order/services/formatOrderTotalPricing.ts) - Format pricing for orders
- [`src/order/services/getDeliveryRanges.ts`](src/order/services/getDeliveryRanges.ts) - Calculate delivery date ranges
- [`src/order/services/getServiceLevelValue.ts`](src/order/services/getServiceLevelValue.ts) - Get service level configuration
- [`src/order/services/sendOrderToSD.ts`](src/order/services/sendOrderToSD.ts) - Send order to Super Dispatch
- [`src/order/services/updateVehiclesWithQuote.ts`](src/order/services/updateVehiclesWithQuote.ts) - Update order vehicles from quote

#### Integrations

- [`src/order/integrations/acertusClient.ts`](src/order/integrations/acertusClient.ts) - Acertus (Vehichaul) integration client
- [`src/order/integrations/sendOrderToSuper.ts`](src/order/integrations/sendOrderToSuper.ts) - Send complete order to Super Dispatch
- [`src/order/integrations/sendPartialOrderToSuper.ts`](src/order/integrations/sendPartialOrderToSuper.ts) - Send partial order (addresses withheld)
- [`src/order/integrations/updateOrderFromSD.ts`](src/order/integrations/updateOrderFromSD.ts) - Update order from Super Dispatch data
- [`src/order/integrations/updateSuperWithCompleteOrder.ts`](src/order/integrations/updateSuperWithCompleteOrder.ts) - Update Super Dispatch with full order details
- [`src/order/integrations/saveSDUpdatesToDB.ts`](src/order/integrations/saveSDUpdatesToDB.ts) - Sync Super Dispatch updates to database

#### Notifications

The Order Service includes comprehensive notification handlers:

- [`src/order/notifications/sendOrderCustomerPublicNew.ts`](src/order/notifications/sendOrderCustomerPublicNew.ts) - New order confirmation
- [`src/order/notifications/sendOrderPickupConfirmation.ts`](src/order/notifications/sendOrderPickupConfirmation.ts) - Pickup confirmation
- [`src/order/notifications/sendOrderDeliveryConfirmation.ts`](src/order/notifications/sendOrderDeliveryConfirmation.ts) - Delivery confirmation
- [`src/order/notifications/sendOrderCustomerSignatureRequest.ts`](src/order/notifications/sendOrderCustomerSignatureRequest.ts) - Signature request
- [`src/order/notifications/sendTrackOrderConfirmation.ts`](src/order/notifications/sendTrackOrderConfirmation.ts) - Tracking confirmation
- [`src/order/notifications/sendTrackOrderNotification.ts`](src/order/notifications/sendTrackOrderNotification.ts) - Tracking updates
- [`src/order/notifications/sendCODPaymentRequest.ts`](src/order/notifications/sendCODPaymentRequest.ts) - COD payment request
- [`src/order/notifications/sendWhiteGloveNotification.ts`](src/order/notifications/sendWhiteGloveNotification.ts) - White glove service notifications
- [`src/order/notifications/sendMMIOrderNotification.ts`](src/order/notifications/sendMMIOrderNotification.ts) - MMI order notifications
- [`src/order/notifications/sendOrderAgent.ts`](src/order/notifications/sendOrderAgent.ts) - Agent notifications
- [`src/order/notifications/requestSignature.ts`](src/order/notifications/requestSignature.ts) - Signature request handling
- [`src/order/notifications/sendSurvey.ts`](src/order/notifications/sendSurvey.ts) - Post-delivery survey

#### API Endpoints

- `GET /api/v1/orders` - List orders
- `POST /api/v1/order` - Create new order
- `GET /api/v1/order/:orderId` - Get single order
- `PATCH /api/v1/order/:orderId` - Update order
- `DELETE /api/v1/order/:orderId` - Delete order
- `GET /api/v1/order/:orderId/activities` - Get order activities
- `POST /api/v1/order/:orderId/track` - Request order tracking
- `POST /api/v1/order/:orderId/status` - Get order status
- `POST /api/v1/order/:orderId/location` - Request driver location
- `PUT /api/v1/order/:orderId/files` - Upload order files
- `PUT /api/v1/order/mcadmin/:orderId/file` - Remove order file (admin)
- `POST /api/v1/order/export` - Export orders to CSV
- `GET /api/v1/order/analytics` - Get order analytics
- `POST /api/v1/order/reports/commission` - Generate commission reports
- `POST /api/v1/order/terms` - Accept order terms
- `POST /api/v1/order/customer` - Create order customer

---

### Survey Service

**Location**: [`src/survey/`](src/survey/)

The Survey Service manages customer satisfaction surveys and feedback collection.

#### Features

- **Survey Creation**: Create surveys with custom questions
- **Portal-Specific Surveys**: Manage surveys per portal
- **Survey Results**: View and export survey responses
- **Public Submission**: Allow public survey submissions without authentication

#### Key Files

- **Routes**: [`src/survey/routes.ts`](src/survey/routes.ts)
- **Schema**: [`src/survey/schema.ts`](src/survey/schema.ts)
- **Controllers**:
  - [`src/survey/controller.ts`](src/survey/controller.ts) - Create survey (public endpoint)
  - [`src/survey/controllers/getSurveys.ts`](src/survey/controllers/getSurveys.ts) - List surveys
  - [`src/survey/controllers/getSurveysByPortal.ts`](src/survey/controllers/getSurveysByPortal.ts) - Get surveys by portal
  - [`src/survey/controllers/getSurveyPortalResults.ts`](src/survey/controllers/getSurveyPortalResults.ts) - Get survey results
  - [`src/survey/controllers/exportSurveys.ts`](src/survey/controllers/exportSurveys.ts) - Export survey data

#### API Endpoints

- `GET /api/v1/surveys` - List surveys
- `POST /api/v1/surveys` - Create survey (public)
- `GET /api/v1/surveys/:portalId` - Get surveys by portal
- `GET /api/v1/surveys/portal/:portalId` - Get survey results for portal
- `GET /api/v1/surveys/export/:portalId` - Export survey data

---

### Survey Response Service

**Location**: [`src/surveyResponse/`](src/surveyResponse/)

The Survey Response Service handles individual survey response submissions and storage.

#### Features

- **Response Storage**: Store individual survey responses
- **Response Retrieval**: Retrieve responses for analysis

#### Key Files

- **Routes**: [`src/surveyResponse/routes.ts`](src/surveyResponse/routes.ts)
- **Schema**: [`src/surveyResponse/schema.ts`](src/surveyResponse/schema.ts)
- **Controller**: [`src/surveyResponse/controller.ts`](src/surveyResponse/controller.ts)

---

## Integrations

### Super Dispatch Integration

**Location**: [`src/_global/integrations/authenticateSuperDispatch.ts`](src/_global/integrations/authenticateSuperDispatch.ts), [`src/order/integrations/`](src/order/integrations/)

Super Dispatch is the primary Transportation Management System (TMS) used for order management and carrier dispatch.

#### Features

- **OAuth Authentication**: Authenticate with Super Dispatch using OAuth2 client credentials
- **Order Submission**: Send orders to Super Dispatch (partial and complete)
- **Order Updates**: Receive and process webhook updates from Super Dispatch
- **Order Synchronization**: Sync order status, pricing, and vehicle information
- **Address Withholding**: Send partial orders initially, reveal full addresses when carrier accepts

#### Key Files

- **Authentication**: [`src/_global/integrations/authenticateSuperDispatch.ts`](src/_global/integrations/authenticateSuperDispatch.ts)
- **Order Integration**:
  - [`src/order/integrations/sendOrderToSuper.ts`](src/order/integrations/sendOrderToSuper.ts) - Send complete order
  - [`src/order/integrations/sendPartialOrderToSuper.ts`](src/order/integrations/sendPartialOrderToSuper.ts) - Send partial order
  - [`src/order/integrations/updateOrderFromSD.ts`](src/order/integrations/updateOrderFromSD.ts) - Update order from SD data
  - [`src/order/integrations/updateSuperWithCompleteOrder.ts`](src/order/integrations/updateSuperWithCompleteOrder.ts) - Update SD with full details
  - [`src/order/integrations/saveSDUpdatesToDB.ts`](src/order/integrations/saveSDUpdatesToDB.ts) - Sync SD updates to database

#### Webhook Handlers

Super Dispatch webhooks are handled by the webhook system (see [Webhook System](#webhook-system)):

- `order.canceled` - Order cancellation
- `order.delivered` - Order delivery confirmation
- `order.invoiced` - Order invoicing
- `order.modified` - Order modifications
- `order.picked_up` - Order pickup confirmation
- `order.removed` - Order removal
- `vehicle.modified` - Vehicle modifications

#### Environment Variables

- `SD_USER` - Super Dispatch username
- `SD_PASS` - Super Dispatch password
- `SUPERDISPATCH_API_URL` - Super Dispatch API URL (default: `https://api.shipper.superdispatch.com/v1/public`)

---

### Acertus Integration

**Location**: [`src/order/integrations/acertusClient.ts`](src/order/integrations/acertusClient.ts)

Acertus (Vehichaul) integration handles special order processing for the Autonation portal.

#### Features

- **Vehicle Creation**: Create vehicles in Acertus system
- **Order Updates**: Send order status updates to Acertus
- **Pickup/Delivery ETAs**: Send estimated arrival times
- **Load Assignment**: Assign vehicles to loads
- **Autonation Portal Support**: Special handling for Autonation portal orders

#### Key Functions

- `sendVehicleCreate()` - Create vehicles in Acertus
- `notifyOrderCreated()` - Notify order creation
- `notifyOrderPickedUp()` - Notify order pickup
- `notifyOrderDelivered()` - Notify order delivery
- `notifyOrderScheduleUpdated()` - Notify schedule changes
- `sendPickupEta()` - Send pickup ETA
- `sendDeliveryEta()` - Send delivery ETA
- `sendVehicleAssign()` - Assign vehicles to loads

#### Environment Variables

- `ACERTUS_AUTONATION_PORTAL_ID` - Autonation portal ID
- `ACERTUS_API_URL` - Acertus API endpoint
- `ACERTUS_API_KEY` - Acertus API key
- `ACERTUS_BASE_URL` - Acertus base URL
- `ACERTUS_CONNECT_UID` - Acertus connect UID
- `ACERTUS_CARRIER_NAME` - Default carrier name
- `ACERTUS_CARRIER_SCAC` - Default carrier SCAC
- `ACERTUS_TIMEOUT_MS` - Request timeout (default: 15000ms)

---

### Webhook System

**Location**: [`src/_global/integrations/webhooks/`](src/_global/integrations/webhooks/)

A comprehensive webhook system for handling external service callbacks and internal event notifications.

#### Features

- **Multi-Source Support**: Handle webhooks from Super Dispatch, carriers, payment processors, and internal events
- **Event Routing**: Route webhooks to appropriate handlers based on event type and source
- **Rate Limiting**: Built-in rate limiting for webhook endpoints
- **Webhook Registry**: Centralized registry for webhook handlers
- **Middleware Support**: Webhook-specific middleware for logging and validation
- **Backward Compatibility**: Legacy callback routes for Super Dispatch

#### Key Files

- **Registry**: [`src/_global/integrations/webhooks/registry.ts`](src/_global/integrations/webhooks/registry.ts) - Webhook registration and routing
- **Handlers**: [`src/_global/integrations/webhooks/handlers.ts`](src/_global/integrations/webhooks/handlers.ts) - Webhook event handlers
- **Types**: [`src/_global/integrations/webhooks/types.ts`](src/_global/integrations/webhooks/types.ts) - TypeScript types
- **Middleware**: [`src/_global/integrations/webhooks/middleware.ts`](src/_global/integrations/webhooks/middleware.ts) - Webhook middleware
- **Callbacks**: [`src/_global/integrations/webhooks/callbacks.ts`](src/_global/integrations/webhooks/callbacks.ts) - Legacy callback handlers
- **Index**: [`src/_global/integrations/webhooks/index.ts`](src/_global/integrations/webhooks/index.ts) - Initialization and configuration

#### Supported Webhook Events

**Super Dispatch Events:**

- `order.canceled` - Order cancellation
- `order.delivered` - Order delivered
- `order.invoiced` - Order invoiced
- `order.modified` - Order modified
- `order.picked_up` - Order picked up
- `order.removed` - Order removed
- `vehicle.modified` - Vehicle modified

**Carrier Events:**

- `carrier.accepted` - Carrier accepted order
- `carrier.accepted_by_shipper` - Carrier accepted by shipper
- `carrier.canceled` - Carrier canceled order
- `offer.sent` - Offer sent to carrier

**Internal Events:**

- `order.created` - Order created
- `order.updated` - Order updated
- `quote.created` - Quote created
- `quote.updated` - Quote updated
- `user.created` - User created
- `user.updated` - User updated
- `portal.created` - Portal created
- `portal.updated` - Portal updated

#### API Endpoints

- `POST /api/v1/webhooks` - Generic webhook endpoint
- `POST /api/v1/webhooks/superdispatch` - Super Dispatch webhooks
- `POST /api/v1/webhooks/carrier` - Carrier webhooks
- `POST /callback/*` - Legacy callback routes (backward compatibility)

#### Scripts

- [`scripts/run-webhook-subscribe.ts`](scripts/run-webhook-subscribe.ts) - Subscribe to webhooks
- [`scripts/run-webhook-unsubscribe.ts`](scripts/run-webhook-unsubscribe.ts) - Unsubscribe from webhooks
- [`scripts/run-webhook-list.ts`](scripts/run-webhook-list.ts) - List webhook subscriptions

---

### Captivated SMS Integration

**Location**: [`src/integration/controllers/captivatedCallback.ts`](src/integration/controllers/captivatedCallback.ts)

Captivated SMS service integration for driver location tracking via SMS.

#### Features

- **Location Tracking**: Receive driver location updates via SMS callback
- **GPS Coordinates**: Update driver latitude/longitude in orders
- **Message Tracking**: Track location requests by message ID

#### API Endpoints

- `POST /api/v1/integration/captivated/callback` - Captivated callback endpoint
- `POST /captivated/callback` - Legacy callback route

---

## Supporting Services

### Authentication Service

**Location**: [`src/auth/`](src/auth/)

Handles user authentication and authorization.

#### Features

- **Email 2FA**: Two-factor authentication via email
- **Social Login**: OAuth social login support
- **API Authentication**: API key authentication for external services
- **Token Management**: JWT token generation and validation

#### Key Files

- **Routes**: [`src/auth/routes.ts`](src/auth/routes.ts)
- **Controllers**:
  - [`src/auth/controllers/verifyEmail2FA.ts`](src/auth/controllers/verifyEmail2FA.ts) - Verify email 2FA code
  - [`src/auth/controllers/loginEmail2FA.ts`](src/auth/controllers/loginEmail2FA.ts) - Login with email 2FA
  - [`src/auth/controllers/authenticateApiUser.ts`](src/auth/controllers/authenticateApiUser.ts) - API user authentication
  - [`src/auth/controllers/loginSocial.ts`](src/auth/controllers/loginSocial.ts) - Social login
- **Services**: [`src/auth/services/authService.ts`](src/auth/services/authService.ts)

#### API Endpoints

- `GET /api/v1/auth/public/auth` - API user authentication
- `POST /api/v1/auth/verify-email-2fa` - Verify email 2FA
- `POST /api/v1/auth/login-email-2fa` - Login with email 2FA
- `POST /api/v1/auth/login-social` - Social login

---

### User Service

**Location**: [`src/user/`](src/user/)

Manages user accounts and permissions.

#### Features

- **User CRUD**: Create, read, update, delete users
- **Portal Association**: Associate users with portals
- **Authorization**: Get current authorized user from token
- **Admin Functions**: Admin-only user creation

#### Key Files

- **Routes**: [`src/user/routes.ts`](src/user/routes.ts)
- **Schema**: [`src/user/schema.ts`](src/user/schema.ts)
- **Controllers**:
  - [`src/user/controllers/createUser.ts`](src/user/controllers/createUser.ts) - Create user
  - [`src/user/controllers/createUserAdmin.ts`](src/user/controllers/createUserAdmin.ts) - Admin user creation
  - [`src/user/controllers/getUser.ts`](src/user/controllers/getUser.ts) - Get single user
  - [`src/user/controllers/getAuthorizedUser.ts`](src/user/controllers/getAuthorizedUser.ts) - Get current user
  - [`src/user/controllers/getUsers.ts`](src/user/controllers/getUsers.ts) - List users
  - [`src/user/controllers/getUsersByPortal.ts`](src/user/controllers/getUsersByPortal.ts) - Get users by portal
  - [`src/user/controllers/updateUser.ts`](src/user/controllers/updateUser.ts) - Update user
  - [`src/user/controllers/deleteUser.ts`](src/user/controllers/deleteUser.ts) - Delete user

#### API Endpoints

- `GET /api/v1/user` - Get current authorized user
- `GET /api/v1/users` - List all users
- `POST /api/v1/user` - Create user
- `GET /api/v1/user/:userId` - Get single user
- `PATCH /api/v1/user/:userId` - Update user
- `DELETE /api/v1/user/:userId` - Delete user
- `POST /api/v1/user/admin/user` - Create user (admin)
- `GET /api/v1/user/users/portal/:portalId` - Get users by portal

---

### Portal Service

**Location**: [`src/portal/`](src/portal/)

Manages customer portals and their configurations.

#### Features

- **Portal CRUD**: Create, read, update, delete portals
- **Portal Configuration**: Manage portal-specific settings and branding
- **Multi-Portal Support**: Support for multiple customer portals

#### Key Files

- **Routes**: [`src/portal/routes.ts`](src/portal/routes.ts)
- **Schema**: [`src/portal/schema.ts`](src/portal/schema.ts)
- **Controllers**:
  - [`src/portal/controllers/createPortal.ts`](src/portal/controllers/createPortal.ts) - Create portal
  - [`src/portal/controllers/getPortal.ts`](src/portal/controllers/getPortal.ts) - Get single portal
  - [`src/portal/controllers/getPortals.ts`](src/portal/controllers/getPortals.ts) - List portals
  - [`src/portal/controllers/updatePortal.ts`](src/portal/controllers/updatePortal.ts) - Update portal
  - [`src/portal/controllers/deletePortal.ts`](src/portal/controllers/deletePortal.ts) - Delete portal

#### API Endpoints

- `GET /api/v1/portals` - List portals
- `POST /api/v1/portal` - Create portal
- `GET /api/v1/portal/:quoteId` - Get single portal (note: parameter name is quoteId for backward compatibility)
- `PATCH /api/v1/portal/:quoteId` - Update portal
- `DELETE /api/v1/portal/:quoteId` - Delete portal

---

### Brand Service

**Location**: [`src/brand/`](src/brand/)

Manages vehicle makes and brands.

#### Features

- **Make Management**: Create and retrieve vehicle makes
- **Brand Lookup**: Get available vehicle brands

#### Key Files

- **Routes**: [`src/brand/routes.ts`](src/brand/routes.ts)
- **Schema**: [`src/brand/schema.ts`](src/brand/schema.ts)
- **Controllers**:
  - [`src/brand/controller.ts`](src/brand/controller.ts) - Create brand
  - [`src/brand/controllers/getMakes.ts`](src/brand/controllers/getMakes.ts) - Get vehicle makes

#### API Endpoints

- `GET /api/v1/brands` - Get vehicle makes
- `POST /api/v1/brand` - Create brand

---

### Modifier Set Service

**Location**: [`src/modifierSet/`](src/modifierSet/)

Manages pricing modifiers that affect quote calculations.

#### Features

- **Modifier CRUD**: Create, read, update, delete modifier sets
- **Global Modifiers**: System-wide pricing modifiers
- **Portal-Specific Modifiers**: Portal-specific pricing adjustments
- **Vehicle Class Modifiers**: Modifiers based on vehicle class

#### Key Files

- **Routes**: [`src/modifierSet/routes.ts`](src/modifierSet/routes.ts)
- **Schema**: [`src/modifierSet/schema.ts`](src/modifierSet/schema.ts)
- **Controller**: [`src/modifierSet/controller.ts`](src/modifierSet/controller.ts)

#### API Endpoints

- `GET /api/v1/modifierSets` - List modifier sets
- `POST /api/v1/modifierSet` - Create modifier set
- `GET /api/v1/modifierSet/:ruleId` - Get single modifier set
- `PUT /api/v1/modifierSet/:ruleId` - Update modifier set
- `DELETE /api/v1/modifierSet/:ruleId` - Delete modifier set

---

### Settings Service

**Location**: [`src/settings/`](src/settings/)

Manages system-wide and customer-specific settings.

#### Features

- **System Settings**: Global system configuration
- **Customer Settings**: Customer-facing settings
- **Settings Updates**: Update configuration values

#### Key Files

- **Routes**: [`src/settings/routes.ts`](src/settings/routes.ts)
- **Schema**: [`src/settings/schema.ts`](src/settings/schema.ts)
- **Controllers**:
  - [`src/settings/controllers/getSettings.ts`](src/settings/controllers/getSettings.ts) - Get system settings
  - [`src/settings/controllers/updateSettings.ts`](src/settings/controllers/updateSettings.ts) - Update settings
  - [`src/settings/controllers/getCustomerSettings.ts`](src/settings/controllers/getCustomerSettings.ts) - Get customer settings

#### API Endpoints

- `GET /api/v1/settings` - Get system settings
- `PUT /api/v1/settings` - Update settings
- `GET /api/v1/settings/customer` - Get customer settings

---

## Infrastructure Services

### Notification System

**Location**: [`src/notification/`](src/notification/)

A comprehensive notification system for email and SMS communications.

#### Features

- **Multi-Provider Support**: SendGrid (email), Twilio (SMS), AWS SNS (SMS alternative)
- **Unified Interface**: Single interface for email and SMS
- **Order Notifications**: Pre-built order notification templates
- **Manual Notifications**: Manually trigger notifications via API
- **Notification Logging**: Track all sent notifications
- **Template Support**: Support for email templates

#### Key Files

- **Manager**: [`src/notification/manager.ts`](src/notification/manager.ts) - Notification manager
- **Email**: [`src/notification/email.ts`](src/notification/email.ts) - Email provider
- **SMS**: [`src/notification/sms.ts`](src/notification/sms.ts) - SMS provider
- **Order Notifications**: [`src/notification/orderNotifications.ts`](src/notification/orderNotifications.ts) - Order-specific notifications
- **Manual Email**: [`src/notification/sendManualEmail.ts`](src/notification/sendManualEmail.ts) - Manual email trigger
- **Carrier Notifications**: [`src/notification/sendCarriers.ts`](src/notification/sendCarriers.ts) - Carrier notifications
- **Types**: [`src/notification/types.ts`](src/notification/types.ts) - TypeScript types
- **Routes**: [`src/notification/routes.ts`](src/notification/routes.ts)

#### Documentation

See [`src/notification/README.md`](src/notification/README.md) for detailed usage examples.

#### Environment Variables

**Email (SendGrid):**

- `SENDGRID_API_KEY` - SendGrid API key
- `EMAIL_FROM_ADDRESS` - Default from address
- `EMAIL_FROM_NAME` - Default from name
- `EMAIL_REPLY_TO` - Default reply-to address
- `EMAIL_ENABLED` - Enable/disable email (default: "true")
- `EMAIL_PROVIDER` - Email provider (default: "sendgrid")

**SMS (Twilio):**

- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_FROM_NUMBER` - Twilio phone number
- `SMS_ENABLED` - Enable/disable SMS (default: "true")
- `SMS_PROVIDER` - SMS provider ("twilio" or "aws-sns")

**SMS (AWS SNS):**

- `AWS_REGION` - AWS region (default: "us-east-1")
- `SMS_FROM_NUMBER` - Default from phone number
- `AWS_ACCESS_KEY_ID` - AWS access key (if not using IAM role)
- `AWS_SECRET_ACCESS_KEY` - AWS secret key (if not using IAM role)

#### API Endpoints

- `POST /api/v1/notifications/send` - Manually trigger notification

---

### Email Service

**Location**: [`src/email/`](src/email/)

Manages email templates and template updates.

#### Features

- **Template Management**: View and update email templates
- **Template Retrieval**: Get individual templates by ID
- **Template Listing**: List all available templates

#### Key Files

- **Routes**: [`src/email/routes.ts`](src/email/routes.ts)
- **Schema**: [`src/email/schema.ts`](src/email/schema.ts)
- **Controllers**:
  - [`src/email/controllers/getEmailTemplates.ts`](src/email/controllers/getEmailTemplates.ts) - List templates
  - [`src/email/controllers/getEmailTemplate.ts`](src/email/controllers/getEmailTemplate.ts) - Get single template
  - [`src/email/controllers/updateEmailTemplate.ts`](src/email/controllers/updateEmailTemplate.ts) - Update template
- **Services**: [`src/email/services/emailService.ts`](src/email/services/emailService.ts)

#### Templates

Email templates are stored in [`src/templates/`](src/templates/) as Handlebars (`.hbs`) files.

#### API Endpoints

- `GET /api/v1/emails` - List email templates
- `GET /api/v1/emails/:templateId` - Get single template
- `PUT /api/v1/emails/:templateId` - Update template

---

### Integration Utilities

**Location**: [`src/integration/`](src/integration/)

General integration utilities and file management.

#### Features

- **S3 File Operations**: Sign S3 URLs for file uploads, retrieve files
- **Captivated Callback**: Handle Captivated SMS callbacks
- **File Management**: Manage files stored in S3

#### Key Files

- **Routes**: [`src/integration/routes.ts`](src/integration/routes.ts)
- **Controllers**:
  - [`src/integration/controllers/signS3.ts`](src/integration/controllers/signS3.ts) - Sign S3 upload URLs
  - [`src/integration/controllers/getFile.ts`](src/integration/controllers/getFile.ts) - Retrieve files from S3
  - [`src/integration/controllers/captivatedCallback.ts`](src/integration/controllers/captivatedCallback.ts) - Captivated callback handler

#### API Endpoints

- `POST /api/v1/integration/sign_s3` - Sign S3 upload URL
- `GET /api/v1/integration/get_file/:fileKey` - Get file from S3
- `POST /api/v1/integration/captivated/callback` - Captivated callback
- `POST /sign_s3` - Legacy S3 signing route
- `GET /get_file/:fileKey` - Legacy file retrieval route
- `POST /captivated/callback` - Legacy Captivated callback route

---

### Cron Jobs

**Location**: [`src/core/cron.ts`](src/core/cron.ts)

Scheduled tasks that run automatically.

#### Features

- **Scheduled Tasks**: Configure cron jobs for recurring tasks

#### Configuration

Cron jobs are initialized in [`src/index.ts`](src/index.ts) via `initializeCronJobs()`.

---

## API Routes

All API routes are prefixed with `/api/v1/`:

- `/api/v1/quote` - Quote management
- `/api/v1/order` - Order management
- `/api/v1/surveys` - Survey management
- `/api/v1/auth` - Authentication
- `/api/v1/user` - User management
- `/api/v1/portal` - Portal management
- `/api/v1/brand` - Brand/make management
- `/api/v1/modifierSet` - Modifier set management
- `/api/v1/settings` - Settings management
- `/api/v1/notifications` - Notification triggers
- `/api/v1/emails` - Email template management
- `/api/v1/integration` - Integration utilities
- `/api/v1/webhooks` - Webhook endpoints

**Health Check:**

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check with database status

---

## Database & Models

**Location**: [`src/_global/models/`](src/_global/models/)

The API uses MongoDB with Mongoose for data modeling. All models are centralized in the `_global/models` directory.

#### Models

- **Quote**: [`src/_global/models/index.ts`](src/_global/models/index.ts) - Quote model
- **Order**: [`src/_global/models/index.ts`](src/_global/models/index.ts) - Order model
- **User**: [`src/_global/models/index.ts`](src/_global/models/index.ts) - User model
- **Portal**: [`src/_global/models/index.ts`](src/_global/models/index.ts) - Portal model
- **Survey**: Survey model
- **SurveyResponse**: Survey response model
- **Settings**: Settings model
- **ModifierSet**: Modifier set model
- **Brand**: Brand/make model

#### Schema Organization

See [`SCHEMA_ORGANIZATION_SUMMARY.md`](SCHEMA_ORGANIZATION_SUMMARY.md) for detailed schema organization documentation.

---

## Migrations

**Location**: [`migrations/`](migrations/)

Database migration scripts for data transformation and schema updates.

#### Migration Scripts

- [`migrations/scripts/migrate-all.ts`](migrations/scripts/migrate-all.ts) - Run all migrations
- [`migrations/scripts/migrate-quotes.ts`](migrations/scripts/migrate-quotes.ts) - Migrate quotes
- [`migrations/scripts/migrate-orders.ts`](migrations/scripts/migrate-orders.ts) - Migrate orders
- [`migrations/scripts/migrate-notification-logs.ts`](migrations/scripts/migrate-notification-logs.ts) - Migrate notification logs
- [`migrations/scripts/migrate-portals.ts`](migrations/scripts/migrate-portals.ts) - Migrate portals
- [`migrations/scripts/migrate-modifier-sets.ts`](migrations/scripts/migrate-modifier-sets.ts) - Migrate modifier sets
- [`migrations/scripts/migrate-users.ts`](migrations/scripts/migrate-users.ts) - Migrate users
- [`migrations/scripts/migrate-surveys.ts`](migrations/scripts/migrate-surveys.ts) - Migrate surveys
- [`migrations/scripts/migrate-survey-responses.ts`](migrations/scripts/migrate-survey-responses.ts) - Migrate survey responses

#### Migration Runner

- [`migrations/run-migration.ts`](migrations/run-migration.ts) - Migration runner utility

#### NPM Scripts

- `npm run migration:run` - Run migrations
- `npm run migration:list` - List migrations
- `npm run migrate:all` - Migrate all data
- `npm run migrate:quotes` - Migrate quotes
- `npm run migrate:orders` - Migrate orders
- `npm run migrate:notification-logs` - Migrate notification logs
- `npm run migrate:portals` - Migrate portals
- `npm run migrate:modifier-sets` - Migrate modifier sets
- `npm run migrate:users` - Migrate users
- `npm run migrate:surveys` - Migrate surveys
- `npm run migrate:survey-responses` - Migrate survey responses

Each migration script supports `down` parameter for rollback: `npm run migrate:quotes down`

---

## Testing

**Location**: [`tests/`](tests/)

The API uses Jest for testing with MongoDB Memory Server for database testing.

#### Test Structure

- [`tests/setup.ts`](tests/setup.ts) - Test setup and configuration
- [`tests/env-setup.js`](tests/env-setup.js) - Environment setup
- [`tests/integration/`](tests/integration/) - Integration tests
- [`tests/quote/`](tests/quote/) - Quote service tests
- [`tests/order/`](tests/order/) - Order service tests
- [`tests/fixtures/`](tests/fixtures/) - Test data fixtures
- [`tests/mocks/`](tests/mocks/) - Mock implementations

#### Test Scripts

- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run test:ci` - Run tests in CI mode

---

## Scripts

**Location**: [`scripts/`](scripts/)

Utility scripts for common operations.

#### Available Scripts

- [`scripts/run-create-acertus-vehicle.ts`](scripts/run-create-acertus-vehicle.ts) - Create vehicle in Acertus
- [`scripts/run-get-carriers.ts`](scripts/run-get-carriers.ts) - Get carriers
- [`scripts/run-send-order-to-acertus.ts`](scripts/run-send-order-to-acertus.ts) - Send order to Acertus
- [`scripts/run-webhook-list.ts`](scripts/run-webhook-list.ts) - List webhook subscriptions
- [`scripts/run-webhook-subscribe.ts`](scripts/run-webhook-subscribe.ts) - Subscribe to webhooks
- [`scripts/run-webhook-unsubscribe.ts`](scripts/run-webhook-unsubscribe.ts) - Unsubscribe from webhooks

---

## Global Utilities

**Location**: [`src/_global/`](src/_global/)

Shared utilities, interfaces, and configurations used across the application.

#### Key Directories

- **Config**: [`src/_global/config.ts`](src/_global/config.ts) - Application configuration
- **Enums**: [`src/_global/enums.ts`](src/_global/enums.ts) - Shared enumerations
- **Interfaces**: [`src/_global/interfaces.ts`](src/_global/interfaces.ts) - Shared TypeScript interfaces
- **Error Handler**: [`src/_global/errorHandler.ts`](src/_global/errorHandler.ts) - Global error handling
- **Utils**: [`src/_global/utils/`](src/_global/utils/) - Utility functions
- **Integrations**: [`src/_global/integrations/`](src/_global/integrations/) - Global integrations

---

## Core Infrastructure

**Location**: [`src/core/`](src/core/)

Core application infrastructure.

#### Components

- **Logger**: [`src/core/logger.ts`](src/core/logger.ts) - Winston-based logging
- **Cron**: [`src/core/cron.ts`](src/core/cron.ts) - Scheduled tasks
- **Middleware**: [`src/core/middleware/security.ts`](src/core/middleware/security.ts) - Security middleware (Helmet, CORS, rate limiting)

---

## Configuration

**Location**: [`src/config/`](src/config/)

Application configuration management.

#### Files

- [`src/config/environment.ts`](src/config/environment.ts) - Environment configuration
- [`src/config/index.ts`](src/config/index.ts) - Configuration exports

---

## Getting Started

### Prerequisites

- Node.js 22.x
- MongoDB
- Environment variables configured (see `.env.example`)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Production

```bash
npm start
```

---

## License

MIT

---

## Support

For questions or issues, please contact the development team.
