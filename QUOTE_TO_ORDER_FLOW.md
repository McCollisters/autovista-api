# Quote to Order Flow - Step-by-Step Guide

This document provides a detailed walkthrough of the complete process from creating a quote to creating and processing an order in the Autovista API.

## Table of Contents

- [Overview](#overview)
- [Part 1: Quote Creation](#part-1-quote-creation)
- [Part 2: Order Creation](#part-2-order-creation)
- [Part 3: Post-Order Processing](#part-3-post-order-processing)
- [Edge Cases & Portal-Specific Flows](#edge-cases--portal-specific-flows)
- [Data Flow Diagrams](#data-flow-diagrams)
- [Key Integrations](#key-integrations)

---

## Overview

The Autovista API follows a two-stage process:

1. **Quote Creation**: Customer requests a quote with vehicle and location information. The system calculates pricing based on distance, vehicle class, modifiers, and service levels.

2. **Order Creation**: Customer converts the quote to an order by providing additional details (pickup/delivery addresses, dates, contact information). The order is then sent to Super Dispatch (TMS) for carrier dispatch.

---

## Part 1: Quote Creation

**Endpoint**: `POST /api/v1/quote`  
**Controller**: [`src/quote/controllers/createQuote.ts`](src/quote/controllers/createQuote.ts)

### Step 1: Request Validation

**Input Data:**

```json
{
  "portalId": "portal_id_here",
  "userId": "user_id_here",
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-1234"
  },
  "origin": "New York, NY",
  "destination": "Los Angeles, CA",
  "vehicles": [
    {
      "year": "2020",
      "make": "Toyota",
      "model": "Camry",
      "pricingClass": "Standard",
      "operable": true
    }
  ],
  "commission": 0
}
```

**Process:**

1. Extract request body data (portalId, userId, customer, origin, destination, vehicles, commission)
2. Validate required fields are present

**Files:**

- [`src/quote/controllers/createQuote.ts`](src/quote/controllers/createQuote.ts) (lines 11-25)

---

### Step 2: Check for Existing Quote

**Service**: [`src/quote/services/matchesExistingQuote.ts`](src/quote/services/matchesExistingQuote.ts)

**Process:**

1. Check if a quote with identical parameters already exists:
   - Same origin and destination
   - Same portal
   - Same vehicles
   - Same commission
2. If match found, return existing quote (prevents duplicate quotes)
3. If no match, proceed with new quote creation

**Files:**

- [`src/quote/services/matchesExistingQuote.ts`](src/quote/services/matchesExistingQuote.ts)

---

### Step 3: Portal Lookup

**Process:**

1. Fetch portal from database using `portalId`
2. Validate portal exists
3. If portal not found, return 404 error

**Files:**

- [`src/quote/controllers/createQuote.ts`](src/quote/controllers/createQuote.ts) (lines 45-49)

---

### Step 4: Location Validation

**Service**: [`src/quote/services/validateLocation.ts`](src/quote/services/validateLocation.ts)

**Process:**

1. Validate origin address:
   - Normalize address format
   - Extract state information
   - Return validated location string
2. Validate destination address:
   - Same process as origin
3. If validation fails, return error

**Output:**

- `originState`: State code (e.g., "NY")
- `originLocation`: Validated address string
- `destinationState`: State code (e.g., "CA")
- `destinationLocation`: Validated address string

**Files:**

- [`src/quote/services/validateLocation.ts`](src/quote/services/validateLocation.ts)
- [`src/quote/controllers/createQuote.ts`](src/quote/controllers/createQuote.ts) (lines 51-65)

---

### Step 5: Geocoding

**Utility**: [`src/_global/utils/location.ts`](src/_global/utils/location.ts) - `getCoordinates()`

**Process:**

1. Convert origin address to coordinates (latitude, longitude)
2. Convert destination address to coordinates
3. If geocoding fails, return error

**Output:**

- `originCoords`: `[longitude, latitude]`
- `destinationCoords`: `[longitude, latitude]`

**Files:**

- [`src/_global/utils/location.ts`](src/_global/utils/location.ts)
- [`src/quote/controllers/createQuote.ts`](src/quote/controllers/createQuote.ts) (lines 67-72)

---

### Step 6: Distance Calculation

**Service**: [`src/quote/services/getMiles.ts`](src/quote/services/getMiles.ts)

**Process:**

1. Calculate distance between origin and destination coordinates
2. Return total miles for the route
3. If calculation fails, return error

**Output:**

- `miles`: Total distance in miles (e.g., 2789)

**Files:**

- [`src/quote/services/getMiles.ts`](src/quote/services/getMiles.ts)
- [`src/quote/controllers/createQuote.ts`](src/quote/controllers/createQuote.ts) (lines 74-78)

---

### Step 7: Vehicle Pricing Calculation

**Service**: [`src/quote/services/updateVehiclesWithPricing.ts`](src/quote/services/updateVehiclesWithPricing.ts)

**Process:**
This is the most complex step. For each vehicle:

1. **Get Base Rate:**
   - Check if portal has custom rates enabled
   - If yes: Use custom base rate from portal configuration
   - If no: Fetch base rate from TMS (Super Dispatch) API
   - Alternative: Use JK base rate if portal has JK calculation enabled

2. **Get Modifiers:**
   - Fetch global modifier set (system-wide pricing modifiers)
   - Fetch portal-specific modifier set (if exists)
   - Apply modifiers based on:
     - Vehicle class (Standard, Oversize, etc.)
     - Inoperable status
     - Route characteristics
     - State-specific modifiers
     - Multi-vehicle discounts
     - Portal discounts
     - Commission rates

3. **Calculate Service Level Pricing:**
   For each service level (1-day, 3-day, 5-day, 7-day, White Glove):
   - Base rate
   - - Inoperable modifier (if applicable)
   - - Oversize modifier (if applicable)
   - - Route modifiers
   - - State modifiers
   - - Vehicle count modifiers
   - - Global discount
   - - Portal discount
   - - Service level fee
   - - Enclosed transport fee (if applicable)
   - - IRR (Insurance Recovery Rate)
   - - Fuel surcharge
   - = Total base price

4. **Calculate Company Tariff:**
   - Apply company tariff percentage/flat fee
   - Apply company tariff discount (if applicable)
   - Add enclosed fee (if applicable)

5. **Calculate Commission:**
   - Apply commission percentage/flat fee

6. **Calculate Final Totals:**
   - Total with company tariff and commission
   - Separate calculations for open and enclosed transport

**Output:**
Array of vehicles with complete pricing structure:

```json
{
  "vehicles": [
    {
      "year": "2020",
      "make": "Toyota",
      "model": "Camry",
      "pricingClass": "Standard",
      "operable": true,
      "pricing": {
        "base": {
          "tms": 1200,
          "custom": 0,
          "whiteGlove": 0
        },
        "modifiers": {
          "inoperable": 0,
          "oversize": 0,
          "routes": 50,
          "states": 25,
          "vehicles": 0,
          "globalDiscount": 0,
          "portalDiscount": 100,
          "irr": 50,
          "fuel": 75,
          "enclosedFlat": 0,
          "enclosedPercent": 0,
          "commission": 0,
          "serviceLevels": [0, 100, 200, 300, 0]
        },
        "totals": {
          "one": {
            "open": {
              "total": 1500,
              "companyTariff": 150,
              "commission": 0,
              "totalWithCompanyTariffAndCommission": 1650
            },
            "enclosed": {
              "total": 1800,
              "companyTariff": 180,
              "commission": 0,
              "totalWithCompanyTariffAndCommission": 1980
            }
          },
          "three": { ... },
          "five": { ... },
          "seven": { ... },
          "whiteGlove": 0
        }
      }
    }
  ]
}
```

**Files:**

- [`src/quote/services/updateVehiclesWithPricing.ts`](src/quote/services/updateVehiclesWithPricing.ts)
- [`src/quote/integrations/getTMSBaseRate.ts`](src/quote/integrations/getTMSBaseRate.ts)
- [`src/quote/integrations/getCustomBaseRate.ts`](src/quote/integrations/getCustomBaseRate.ts)
- [`src/quote/integrations/getJKBaseRate.ts`](src/quote/integrations/getJKBaseRate.ts)
- [`src/quote/controllers/createQuote.ts`](src/quote/controllers/createQuote.ts) (lines 80-87)

---

### Step 8: Total Pricing Calculation

**Service**: [`src/quote/services/calculateTotalPricing.ts`](src/quote/services/calculateTotalPricing.ts)

**Process:**

1. Aggregate pricing across all vehicles
2. Calculate totals for each service level:
   - Sum base rates
   - Sum all modifiers
   - Calculate service level totals
   - Calculate company tariffs
   - Calculate commissions
   - Calculate final totals with company tariff and commission
3. Separate calculations for open and enclosed transport

**Output:**

```json
{
  "totalPricing": {
    "base": 1200,
    "modifiers": {
      "inoperable": 0,
      "oversize": 0,
      "globalDiscount": 0,
      "routes": 50,
      "states": 25,
      "vehicles": 0,
      "portalDiscount": 100,
      "commission": 0,
      "companyTariffs": [],
      "irr": 50,
      "fuel": 75,
      "enclosedFlat": 0,
      "enclosedPercent": 0,
      "serviceLevels": [0, 100, 200, 300, 0]
    },
    "totals": {
      "one": {
        "open": {
          "total": 1500,
          "companyTariff": 150,
          "commission": 0,
          "totalWithCompanyTariffAndCommission": 1650
        },
        "enclosed": {
          "total": 1800,
          "companyTariff": 180,
          "commission": 0,
          "totalWithCompanyTariffAndCommission": 1980
        }
      },
      "three": { ... },
      "five": { ... },
      "seven": { ... },
      "whiteGlove": 0
    }
  }
}
```

**Files:**

- [`src/quote/services/calculateTotalPricing.ts`](src/quote/services/calculateTotalPricing.ts)
- [`src/quote/controllers/createQuote.ts`](src/quote/controllers/createQuote.ts) (line 89)

---

### Step 9: Quote Object Creation

**Process:**

1. Build quote object with all calculated data:
   - Status: `Active`
   - Portal ID
   - User ID
   - Customer information
   - Origin (user input, validated location, state, coordinates)
   - Destination (user input, validated location, state, coordinates)
   - Miles
   - Vehicles with pricing
   - Total pricing
2. Generate unique quote ID (if using auto-increment)

**Files:**

- [`src/quote/controllers/createQuote.ts`](src/quote/controllers/createQuote.ts) (lines 91-117)

---

### Step 10: Save Quote to Database

**Process:**

1. Create new Quote document in MongoDB
2. Save quote with all calculated data
3. Return created quote to client

**Files:**

- [`src/quote/controllers/createQuote.ts`](src/quote/controllers/createQuote.ts) (lines 119-123)

---

## Part 2: Order Creation

**Endpoint**: `POST /api/v1/order`  
**Controller**: [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts)

### Step 1: Request Validation

**Input Data:**

```json
{
  "quoteId": "quote_id_here",
  "portalId": "portal_id_here",
  "customerFirstName": "John",
  "customerLastName": "Doe",
  "customerEmail": "john@example.com",
  "customerPrimaryPhone": "555-1234",
  "reg": "PO-12345",
  "serviceLevel": 5,
  "paymentType": "Billing",
  "pickupStartDate": "2024-01-15",
  "pickupAddress": "123 Main St",
  "pickupCity": "New York",
  "pickupState": "NY",
  "pickupZip": "10001",
  "pickupContactName": "John Doe",
  "pickupPrimaryPhone": "555-1234",
  "deliveryAddress": "456 Oak Ave",
  "deliveryCity": "Los Angeles",
  "deliveryState": "CA",
  "deliveryZip": "90001",
  "deliveryContactName": "Jane Doe",
  "deliveryPrimaryPhone": "555-5678",
  "transportType": "OPEN",
  "quotes": [
    {
      "vin": "4T1BF1FK5EU123456",
      "year": "2020"
    }
  ]
}
```

**Process:**

1. Extract and validate required fields:
   - `quoteId` (required)
   - `portalId` (required)
   - `pickupStartDate` (required)
   - Pickup address details
   - Delivery address details
   - Customer information
2. Set default values:
   - `payment` defaults to "Billing" (unless portal-specific override)
   - `moveType` defaults to "other"
   - `pickupLocationType` defaults to "Residence"
3. Add required notes:
   - Pickup notes: "MUST have signed BOL at pickup"
   - Delivery notes: "MUST have signed BOL at delivery"

**Files:**

- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 15-125)

---

### Step 2: Database Lookups

**Process:**

1. Fetch portal from database
2. Fetch quote from database
3. Validate both exist
4. If either not found, return 404 error

**Files:**

- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 128-156)

---

### Step 3: Update Quote Status

**Process:**

1. Update quote status from `Active` to `Booked`
2. Save quote to database
3. This prevents the quote from being used again

**Files:**

- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 158-168)

---

### Step 4: Extract Quote Data

**Process:**

1. Extract data from quote:
   - `isCustomerPortal`: Whether this is a customer portal order
   - `originalQuotes`: Original vehicle quotes from quote
   - `transitTime`: Estimated transit time
   - `uniqueId`: Unique quote identifier
   - `transportType`: Transport type (if not provided in request)
2. Check if delivery address has changed from quote
3. If changed, log the change (transit time recalculation may be needed)

**Files:**

- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 170-207)

---

### Step 5: Check for Existing Order

**Process:**

1. Check if an order already exists for this quote
2. If exists, return 409 Conflict error
3. Prevents duplicate orders from same quote

**Files:**

- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 215-235)

---

### Step 6: Load Settings

**Process:**

1. Fetch system settings from database
2. Extract holiday dates for date range calculations
3. If no settings found, use empty holiday array

**Files:**

- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 237-252)

---

### Step 7: Geocode Addresses

**Utility**: [`src/_global/utils/geocode.ts`](src/_global/utils/geocode.ts)

**Process:**

1. Build full address strings:
   - Pickup: `"{pickupAddress} {pickupCity} {pickupState} {pickupZip}"`
   - Delivery: `"{deliveryAddress} {deliveryCity} {deliveryState} {deliveryZip}"`
2. Geocode pickup address to coordinates
3. Geocode delivery address to coordinates
4. Validate coordinates are valid
5. If geocoding fails, return error

**Output:**

- `pickupCoords`: `{ latitude, longitude }`
- `deliveryCoords`: `{ latitude, longitude }`

**Files:**

- [`src/_global/utils/geocode.ts`](src/_global/utils/geocode.ts)
- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 262-305)

---

### Step 8: Format Phone Numbers

**Utility**: [`src/_global/utils/formatPhoneNumber.ts`](src/_global/utils/formatPhoneNumber.ts)

**Process:**

1. Format all phone numbers to consistent format
2. Separate mobile and landline numbers:
   - Customer mobile/phone
   - Pickup mobile/phone
   - Delivery mobile/phone
3. Handle cases where primary phone is mobile vs. landline

**Files:**

- [`src/_global/utils/formatPhoneNumber.ts`](src/_global/utils/formatPhoneNumber.ts)
- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 307-373)

---

### Step 9: Calculate Date Ranges

**Utility**: [`src/_global/utils/getDateRanges.ts`](src/_global/utils/getDateRanges.ts)

**Process:**

1. Calculate delivery date ranges based on:
   - Pickup start date
   - Service level (transit time)
   - Transit time from quote
   - Holiday dates (excluded from calculations)
2. Return array of dates:
   - `[0]`: Pickup start date
   - `[1]`: Pickup end date
   - `[2]`: Delivery start date
   - `[3]`: Delivery end date

**Output:**

```javascript
[
  "2024-01-15T00:00:00Z", // Pickup start
  "2024-01-15T23:59:59Z", // Pickup end
  "2024-01-20T00:00:00Z", // Delivery start (5-day service)
  "2024-01-20T23:59:59Z", // Delivery end
];
```

**Files:**

- [`src/_global/utils/getDateRanges.ts`](src/_global/utils/getDateRanges.ts)
- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 375-409)

---

### Step 10: Merge Vehicle Data

**Process:**

1. Merge request vehicle data (VIN, year) with original quote vehicle data
2. Preserve calculated quotes from original quote
3. Ensure all vehicles from quote are included
4. If no vehicles found, return error

**Files:**

- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 411-428)

---

### Step 11: Send Partial Order to Super Dispatch

**Integration**: [`src/order/integrations/sendPartialOrderToSuper.ts`](src/order/integrations/sendPartialOrderToSuper.ts)

**Process:**

1. **Skip if:**
   - Payment type is "COD"
   - Transport type is "WHITEGLOVE"
2. **Authenticate with Super Dispatch:**
   - Get OAuth token using credentials
3. **Format order data:**
   - Vehicle data with tariffs
   - Origin: City, State, ZIP only (address withheld)
   - Destination: City, State, ZIP only (address withheld)
   - Pickup/delivery date ranges
   - Transport type
   - Service level
4. **Send to Super Dispatch API:**
   - POST to `https://api.shipper.superdispatch.com/v1/public/orders`
   - Include authorization token
5. **Handle response:**
   - Extract Super Dispatch GUID
   - Store for later use
   - If error, return error to client

**Why Partial Order?**

- Addresses are withheld initially for privacy
- Full addresses are revealed when carrier accepts the order
- Prevents carriers from contacting customers directly before acceptance

**Output:**

- `superResponse`: Super Dispatch order object with GUID
- `tms.guid`: Super Dispatch order identifier

**Files:**

- [`src/order/integrations/sendPartialOrderToSuper.ts`](src/order/integrations/sendPartialOrderToSuper.ts)
- [`src/_global/integrations/authenticateSuperDispatch.ts`](src/_global/integrations/authenticateSuperDispatch.ts)
- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 430-481)

---

### Step 12: Process Vehicle Data

**Service**: [`src/order/services/updateVehiclesWithQuote.ts`](src/order/services/updateVehiclesWithQuote.ts)

**Process:**
For each vehicle:

1. Match vehicle from request with vehicle from quote (by make/model)
2. Extract pricing for selected service level
3. Set company tariff based on transport type (open/enclosed)
4. Set vehicle tariff based on transport type
5. Set operable status (boolean)
6. Format vehicle type (pricing class)
7. Include all pricing data from quote

**Output:**
Array of vehicles with complete pricing and order-specific data:

```json
{
  "vehicles": [
    {
      "year": "2020",
      "make": "Toyota",
      "model": "Camry",
      "vin": "4T1BF1FK5EU123456",
      "operable": true,
      "operableBool": true,
      "pricingClass": "standard",
      "type": "standard",
      "tariff": 1500,
      "pricing": { ... }
    }
  ]
}
```

**Files:**

- [`src/order/services/updateVehiclesWithQuote.ts`](src/order/services/updateVehiclesWithQuote.ts)
- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 483-603)

---

### Step 13: Determine User and Agent Information

**Process:**

1. Check if customer portal order:
   - If yes: Set user as "Customer Order", no user ID
   - If no: Use user from quote
2. Look up user in database (if user ID exists)
3. Set agent information:
   - Agent email (from user or default)
   - Agent name
   - Pickup/delivery notifications enabled
4. Handle special portal cases (e.g., Autodesk portal)

**Files:**

- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 605-669)

---

### Step 14: Extract Pricing for Selected Service Level

**Process:**

1. Get pricing from quote for selected service level
2. If enclosed transport:
   - Use enclosed transport totals
   - Apply enclosed markup (if configured)
3. Set total SD (Super Dispatch) and total Portal pricing

**Files:**

- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 671-678)

---

### Step 15: Build Order Object

**Process:**

1. Create comprehensive order object with:
   - **Customer Information:**
     - Name, email, phone (mobile and landline)
   - **Origin (Pickup):**
     - Address, city, state, ZIP
     - Coordinates
     - Contact information
     - Notes
     - Location type
   - **Destination (Delivery):**
     - Address, city, state, ZIP
     - Coordinates
     - Contact information
     - Notes
     - Location type
   - **Schedule:**
     - Pickup selected date
     - Pickup estimated range
     - Delivery estimated range
   - **Vehicles:**
     - All vehicle data with pricing
   - **Pricing:**
     - Total pricing for selected service level
     - Company tariff
     - Commission
   - **TMS Integration:**
     - Super Dispatch GUID (if sent)
     - TMS status
   - **Order Metadata:**
     - Unique ID
     - Reference number (reg)
     - Portal ID
     - Quote reference
     - Service level
     - Transport type
     - Payment type
     - Status
     - Agents
     - User information

**Files:**

- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 680-850+)

---

### Step 16: Save Order to Database

**Process:**

1. Create new Order document in MongoDB
2. Save order with all data
3. Order status set to:
   - `"Pending"` if payment is COD
   - `"Booked"` if payment is Billing

**Files:**

- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 850+)

---

### Step 17: Send Notifications

**Process:**
Send appropriate notifications based on order type:

1. **Customer Confirmation:**
   - [`src/order/notifications/sendOrderCustomerPublicNew.ts`](src/order/notifications/sendOrderCustomerPublicNew.ts)
   - Sent to customer with order details

2. **White Glove Notification:**
   - [`src/order/notifications/sendWhiteGloveNotification.ts`](src/order/notifications/sendWhiteGloveNotification.ts)
   - If transport type is WHITEGLOVE

3. **MMI Order Notification:**
   - [`src/order/notifications/sendMMIOrderNotification.ts`](src/order/notifications/sendMMIOrderNotification.ts)
   - If portal is MMI portal

4. **COD Payment Request:**
   - [`src/order/notifications/sendCODPaymentRequest.ts`](src/order/notifications/sendCODPaymentRequest.ts)
   - If payment type is COD

**Files:**

- [`src/order/notifications/`](src/order/notifications/)
- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (end of file)

---

### Step 18: Return Order Response

**Process:**

1. Return created order object to client
2. Include Super Dispatch GUID if order was sent to TMS
3. Include all order details

**Files:**

- [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (end of file)

---

## Part 3: Post-Order Processing

After an order is created, several automated processes occur:

### Super Dispatch Webhook Updates

When events occur in Super Dispatch, webhooks are sent to update the order:

1. **Order Modified** (`order.modified`):
   - Updates order details in database
   - Syncs pricing, vehicles, dates

2. **Carrier Accepted** (`carrier.accepted`):
   - Updates order status
   - Reveals full addresses to carrier
   - Sends full order details to Super Dispatch

3. **Order Picked Up** (`order.picked_up`):
   - Updates pickup date
   - Sends pickup confirmation to customer
   - Updates order status

4. **Order Delivered** (`order.delivered`):
   - Updates delivery date
   - Sets order status to "Complete"
   - Sends delivery confirmation
   - Triggers post-delivery survey

5. **Order Invoiced** (`order.invoiced`):
   - Updates invoice information
   - Records invoice details

**Files:**

- [`src/_global/integrations/webhooks/handlers.ts`](src/_global/integrations/webhooks/handlers.ts)
- [`src/order/integrations/updateOrderFromSD.ts`](src/order/integrations/updateOrderFromSD.ts)
- [`src/order/integrations/updateSuperWithCompleteOrder.ts`](src/order/integrations/updateSuperWithCompleteOrder.ts)

### Acertus Integration (Autonation Portal)

For Autonation portal orders, additional integration occurs:

1. **Vehicle Creation:**
   - Create vehicles in Acertus system
   - Send vehicle details with VIN, make, model

2. **Order Updates:**
   - Send order status updates
   - Send pickup/delivery ETAs
   - Send load assignment when carrier accepts

**Files:**

- [`src/order/integrations/acertusClient.ts`](src/order/integrations/acertusClient.ts)

---

## Edge Cases & Portal-Specific Flows

This section covers special handling, edge cases, and portal-specific logic that affects the quote and order creation process.

### Portal-Specific Payment Type Overrides

**Location**: [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 93-101)

Certain portals automatically force orders to use COD (Cash on Delivery) payment, regardless of the payment type specified in the request:

**Portals that Force COD:**

- `5f2ad881ed5a090017f91715` - Suddath Relocation
- `64ece35abfc3deb98e9d180f` - Mc Instant Quote
- `6384ea07928af40046d4d22a`
- `6717abfa768fb54a3c6823b9` - Tim Toton
- `6453ff09eafb1843de4d5cd1`

**Behavior:**

- If order is from one of these portals, `payment` is automatically set to `"COD"`
- This overrides any payment type specified in the request
- COD orders have different status handling (see [COD vs Billing Status](#cod-vs-billing-status))

---

### COD vs Billing Status

**Location**: [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 683, 698, 761, 821, 836)

Orders have different initial statuses based on payment type:

**COD Orders:**

- Status: `"Pending"` (not sent to Super Dispatch initially)
- Order Table Status: `"Pending"`
- Super Dispatch: **Not sent** (payment must be received first)
- COD Payment Request: Email sent to customer requesting payment

**Billing Orders:**

- Status: `"Booked"` (ready for dispatch)
- Order Table Status: `"New"`
- Super Dispatch: **Sent immediately** (partial order with withheld addresses)

**Why the Difference?**

- COD orders require payment before dispatch
- Billing orders can be dispatched immediately (customer billed later)

---

### White Glove Transport

**Location**: [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 432, 936-948)

White Glove transport has special handling:

**Behavior:**

- **Super Dispatch**: **Not sent** (White Glove handled internally)
- **Notification**: Special White Glove notification sent to customer
- **Status**: Set to `"Booked"` (same as billing orders)
- **Processing**: Handled through internal processes, not TMS

**Why Skip Super Dispatch?**

- White Glove is a premium service handled by internal teams
- Doesn't go through standard carrier dispatch process

---

### MMI Portal Special Handling

**Location**: [`src/_global/constants/portalIds.ts`](src/_global/constants/portalIds.ts), [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 951-969)

MMI (Move Management Inc.) portals have special notification and template handling:

**MMI Portal IDs:**

- `60d364c5176cba0017cbd78f` - MMI Portal 1 (Autodesk)
- `67d036b3e29c00962804a466` - MMI Portal 2

**Special Behaviors:**

1. **MMI Order Notification:**
   - Special notification sent to `autodesk@graebel.com`
   - Uses MMI-specific email template
   - Sent after order creation

2. **Autodesk Portal (MMI_1) Special Agent:**
   - Agent email automatically set to `autodeskupdates@graebel.com`
   - Agent name: "Auto Desk"
   - Overrides normal user-based agent assignment

3. **HelloSign Templates:**
   - MMI portals use different HelloSign template for signature requests
   - Template ID: `0becbee2fecda15bf3b5d0a820d08cfb4c4ce90b`
   - Regular portals use different template

**Files:**

- [`src/order/notifications/sendMMIOrderNotification.ts`](src/order/notifications/sendMMIOrderNotification.ts)
- [`src/order/notifications/requestSignature.ts`](src/order/notifications/requestSignature.ts)

---

### Customer Portal vs Regular Portal

**Location**: [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 608-614)

Orders from customer portals (public-facing) have different user/agent handling:

**Customer Portal Orders (`isCustomerPortal: true`):**

- User Name: `"Customer Order"`
- User ID: `null` (no associated user)
- Agent: Default agent or customer service email
- No user lookup performed

**Regular Portal Orders (`isCustomerPortal: false`):**

- User Name: From quote (original user who created quote)
- User ID: From quote
- Agent: Looked up from user database
- User must exist in system

**Why the Difference?**

- Customer portals allow public order creation without user accounts
- Regular portals require authenticated users

---

### Address Change Detection

**Location**: [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 179-207)

The system detects when delivery address changes from quote to order:

**Detection Logic:**

1. Extract city and state from original quote delivery address
2. Compare with new delivery city and state from order request
3. If city or state differs, address is considered changed

**Current Behavior:**

- **Logs the change** for tracking purposes
- **Does NOT recalculate transit time** (uses original from quote)
- **Note**: Transit time recalculation is planned but not yet implemented

**Why This Matters:**

- Address changes can affect delivery dates
- Currently uses original transit time, which may be inaccurate
- Future enhancement: Recalculate transit time when address changes

**Example:**

```
Original Quote: "Los Angeles, CA"
Order Request: "San Francisco, CA"
Result: Address change logged, but original transit time used
```

---

### Existing Quote Matching

**Location**: [`src/quote/services/matchesExistingQuote.ts`](src/quote/services/matchesExistingQuote.ts)

The system prevents duplicate quotes by matching against existing quotes:

**Matching Criteria:**

1. **Same origin** (user input must match exactly)
2. **Same destination** (user input must match exactly)
3. **Same portal** (portalId must match)
4. **Created within 30 days** (quotes older than 30 days are not matched)
5. **Same number of vehicles**
6. **Same vehicle make/model** (in same order)
7. **Same commission** (if commission was set)

**Behavior:**

- If match found: Returns existing quote (prevents duplicate)
- If no match: Creates new quote
- Matching is case-sensitive for addresses

**Why 30-Day Window?**

- Pricing may change over time
- Old quotes may have outdated pricing
- Prevents matching against stale quotes

---

### Existing Order Check

**Location**: [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 215-235)

The system prevents creating duplicate orders from the same quote:

**Check Logic:**

1. Query database for orders with matching `quote._id`
2. If order exists: Return 409 Conflict error
3. If no order: Proceed with order creation

**Why This Matters:**

- Quotes can only be converted to one order
- Prevents accidental duplicate orders
- Ensures quote status update is valid

**Error Response:**

```json
{
  "statusCode": 409,
  "message": "Order already exists for this quote."
}
```

---

### Partial Order Flag

**Location**: [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 903-906)

Orders sent to Super Dispatch are marked as partial orders:

**Flag Logic:**

```typescript
tmsPartialOrder: payment !== "COD" &&
transportType !== "WHITEGLOVE" &&
superResponse
  ? true
  : false;
```

**When Set to `true`:**

- Order was sent to Super Dispatch
- Addresses are initially withheld
- Full addresses revealed when carrier accepts

**When Set to `false`:**

- COD order (not sent to Super Dispatch)
- White Glove order (not sent to Super Dispatch)
- Super Dispatch integration failed

**Why This Matters:**

- Used in webhook handlers to preserve address data
- Prevents overwriting withheld addresses with Super Dispatch data
- See [Address Withholding](#address-withholding) section

---

### Address Withholding

**Location**: [`src/order/integrations/sendPartialOrderToSuper.ts`](src/order/integrations/sendPartialOrderToSuper.ts), [`src/order/integrations/updateOrderFromSD.ts`](src/order/integrations/updateOrderFromSD.ts)

Orders sent to Super Dispatch initially have addresses withheld:

**Initial Partial Order:**

- Origin: City, State, ZIP only (address withheld)
- Destination: City, State, ZIP only (address withheld)
- Full addresses stored in local database

**When Addresses Are Revealed:**

- When carrier accepts the order
- Full order details sent to Super Dispatch
- Addresses become visible to carrier

**Address Preservation Logic:**
When Super Dispatch webhooks update the order:

- If `tmsPartialOrder === true`: Preserve existing addresses (don't overwrite)
- If address contains "WITTHELD": Preserve existing address
- Otherwise: Update with Super Dispatch address data

**Why Withhold Addresses?**

- Privacy protection for customers
- Prevents carriers from contacting customers before acceptance
- Standard practice in transportation industry

---

### Acertus Integration (Autonation Portal Only)

**Location**: [`src/order/integrations/acertusClient.ts`](src/order/integrations/acertusClient.ts)

Acertus (Vehichaul) integration is **only** active for Autonation portal orders:

**Portal ID:**

- `62b89733d996a00046fe815e` - Autonation Portal

**Integration Functions:**

- `sendVehicleCreate()` - Creates vehicles in Acertus
- `notifyOrderCreated()` - Sends order creation notification
- `notifyOrderPickedUp()` - Sends pickup notification
- `notifyOrderDelivered()` - Sends delivery notification
- `sendPickupEta()` - Sends pickup ETA
- `sendDeliveryEta()` - Sends delivery ETA
- `sendVehicleAssign()` - Assigns vehicles to loads

**Behavior:**

- All Acertus functions check `isAutonationPortal()` first
- If not Autonation portal: Function returns early (no action)
- If Autonation portal: Full integration active

**Why Portal-Specific?**

- Acertus is specific to Autonation's workflow
- Other portals use Super Dispatch only
- Prevents unnecessary API calls

---

### Error Handling & Graceful Degradation

**Location**: Throughout [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts)

The system handles errors gracefully to prevent order creation failures:

**Notification Errors:**

- Notification failures **do NOT fail order creation**
- Errors are logged but order is still created
- Applies to:
  - White Glove notifications
  - MMI notifications
  - COD payment requests
  - Customer confirmation emails
  - Acertus notifications

**Database Errors:**

- Quote/Portal lookup failures: Return 500 error
- Order creation failures: Return 500 error
- Quote status update failures: Return 500 error

**Geocoding Errors:**

- If geocoding fails: Return 500 error with message
- Order creation is blocked (addresses required)

**Super Dispatch Errors:**

- If Super Dispatch fails: Return 500 error
- Order creation is blocked (for non-COD, non-WhiteGlove orders)

**Missing Data Handling:**

- Missing customer email: Warning logged, order still created
- Missing user: Default agent assigned
- Missing settings: Empty holiday array used

---

### Quote Expiration & Matching Window

**Location**: [`src/quote/services/matchesExistingQuote.ts`](src/quote/services/matchesExistingQuote.ts) (lines 16-24)

Quotes are matched against existing quotes within a 30-day window:

**Window Logic:**

```typescript
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
```

**Matching Query:**

- Only matches quotes created within last 30 days
- Quotes older than 30 days are ignored
- Prevents matching against stale pricing

**Why 30 Days?**

- Pricing can change over time
- Base rates may be updated
- Modifiers may change
- Ensures customers get current pricing

---

### Vehicle Data Merging

**Location**: [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 414-421)

Vehicle data from order request is merged with original quote data:

**Merge Logic:**

```typescript
quotes = originalQuotes.map((originalVehicle, index) => {
  const requestVehicle = req.body.quotes?.[index] || {};
  return {
    ...originalVehicle,
    ...requestVehicle, // VIN and year from request
    calculatedQuotes: originalVehicle.calculatedQuotes, // Preserve pricing
  };
});
```

**What Gets Merged:**

- **From Request**: VIN, year (if provided)
- **From Quote**: Make, model, pricing, calculated quotes
- **Preserved**: All pricing calculations from quote

**Why Merge?**

- Quote may not have VIN (customer provides later)
- Pricing must be preserved from quote
- Allows customer to add VIN at order time

---

### Enclosed Transport Pricing

**Location**: [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 673-678)

Enclosed transport has different pricing than open transport:

**Pricing Selection:**

```typescript
if (transportType === "ENCLOSED") {
  pricing.totalSD = quote.totalPricing[serviceLevel].totalEnclosedTransportSD;
  pricing.totalPortal =
    quote.totalPricing[serviceLevel].totalEnclosedTransportPortal;
}
```

**Enclosed Transport Fees:**

- Flat fee: Applied as fixed amount
- Percentage fee: Applied as percentage of base
- Company tariff: May include additional enclosed fee
- Both fees can apply simultaneously

**Why Separate Pricing?**

- Enclosed transport is more expensive
- Requires specialized equipment
- Different pricing structure than open transport

---

### Service Level Selection

**Location**: [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 522-533, 671)

Service level determines which pricing tier is used:

**Service Levels:**

- `1` - 1-Day Service
- `3` - 3-Day Service
- `5` - 5-Day Service (most common)
- `7` - 7-Day Service
- `4` - White Glove Service

**Pricing Selection:**

```typescript
let calculatedQuote = calculatedQuotes.find((q) => {
  return parseInt(q.days) === serviceLevel;
});
```

**Error Handling:**

- If service level not found: Return error
- Service level must match one of the calculated quotes
- Each vehicle must have pricing for selected service level

---

### Phone Number Formatting & Mobile Detection

**Location**: [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 307-373)

Phone numbers are formatted and separated into mobile/landline:

**Formatting:**

- All phone numbers formatted to consistent format
- Uses `formatPhoneNumber()` utility

**Mobile Detection:**

- Customer can specify if phone is mobile
- System separates mobile vs. landline numbers
- Mobile numbers used for SMS notifications
- Landline numbers used for voice calls

**Logic:**

- If primary phone is mobile: Use as mobile, alt as phone
- If primary phone is landline: Use as phone, alt as mobile (if alt is mobile)
- Handles various combinations

---

### Date Range Calculation with Holidays

**Location**: [`src/order/controllers/createOrder.ts`](src/order/controllers/createOrder.ts) (lines 375-409)

Delivery dates are calculated excluding holidays:

**Input:**

- Pickup start date
- Service level (transit time)
- Transit time from quote
- Holiday dates from settings

**Output:**

- `[0]`: Pickup start date
- `[1]`: Pickup end date
- `[2]`: Delivery start date (estimated)
- `[3]`: Delivery end date (estimated)

**Holiday Exclusion:**

- Holidays are excluded from date calculations
- Prevents scheduling pickups/deliveries on holidays
- Uses system settings for holiday list

**Error Handling:**

- If date calculation fails: Return 500 error
- If invalid date ranges: Return 500 error
- Order creation blocked if dates invalid

---

### Sirva Portal Special Handling

**Location**: [`src/_global/constants/portalIds.ts`](src/_global/constants/portalIds.ts)

Sirva portals use special email templates:

**Sirva Portal IDs:**

- `621e2882dee77a00351e5aac` - Sirva 1
- `65fb221d27f5b6f47701f8ea` - Sirva 2
- `66056b34982f1bf738687859` - Sirva 3
- `5e99f0b420e68d5f479d7317` - Sirva 4

**Special Templates:**

- Sirva-specific email templates
- Different branding/formatting
- Portal-specific notification content

---

## Data Flow Diagrams

### Quote Creation Flow

```
Client Request
    ↓
Validate Request
    ↓
Check Existing Quote → [Match Found?] → Return Existing Quote
    ↓ [No Match]
Fetch Portal
    ↓
Validate Locations
    ↓
Geocode Addresses
    ↓
Calculate Distance
    ↓
For Each Vehicle:
    ├─ Get Base Rate (TMS/Custom/JK)
    ├─ Get Modifiers (Global + Portal)
    ├─ Calculate Service Level Pricing
    ├─ Calculate Company Tariff
    └─ Calculate Commission
    ↓
Calculate Total Pricing
    ↓
Create Quote Object
    ↓
Save to Database
    ↓
Return Quote
```

### Order Creation Flow

```
Client Request
    ↓
Validate Request
    ↓
Fetch Portal & Quote
    ↓
Update Quote Status → "Booked"
    ↓
Geocode Addresses
    ↓
Format Phone Numbers
    ↓
Calculate Date Ranges
    ↓
Merge Vehicle Data
    ↓
Send Partial Order to Super Dispatch
    ↓
Process Vehicle Pricing
    ↓
Build Order Object
    ↓
Save Order to Database
    ↓
Send Notifications
    ↓
Return Order
```

### Post-Order Webhook Flow

```
Super Dispatch Event
    ↓
Webhook Received
    ↓
Route to Handler
    ↓
Update Order in Database
    ↓
Send Notifications (if needed)
    ↓
Update Acertus (if Autonation)
    ↓
Return Success
```

---

## Key Integrations

### Super Dispatch (TMS)

- **Authentication**: OAuth2 client credentials
- **Base Rate API**: Fetch vehicle base rates
- **Order API**: Create and update orders
- **Webhooks**: Receive order status updates

**Files:**

- [`src/_global/integrations/authenticateSuperDispatch.ts`](src/_global/integrations/authenticateSuperDispatch.ts)
- [`src/order/integrations/sendPartialOrderToSuper.ts`](src/order/integrations/sendPartialOrderToSuper.ts)
- [`src/order/integrations/sendOrderToSuper.ts`](src/order/integrations/sendOrderToSuper.ts)
- [`src/_global/integrations/webhooks/`](src/_global/integrations/webhooks/)

### Acertus (Vehichaul)

- **Vehicle Creation**: Create vehicles in Acertus
- **Order Updates**: Send status updates
- **ETA Updates**: Send pickup/delivery ETAs
- **Load Assignment**: Assign vehicles to loads

**Files:**

- [`src/order/integrations/acertusClient.ts`](src/order/integrations/acertusClient.ts)

### Notification System

- **Email**: SendGrid integration
- **SMS**: Twilio integration
- **Templates**: Handlebars email templates

**Files:**

- [`src/notification/`](src/notification/)
- [`src/order/notifications/`](src/order/notifications/)

---

## Summary

The quote-to-order flow involves:

1. **Quote Creation** (10 steps):
   - Validation, location processing, distance calculation
   - Complex pricing calculation with modifiers
   - Service level pricing for multiple options

2. **Order Creation** (18 steps):
   - Extensive validation and data processing
   - Integration with Super Dispatch TMS
   - Comprehensive order object creation
   - Notification sending

3. **Post-Order Processing**:
   - Webhook handling for status updates
   - Additional integrations (Acertus)
   - Automated notifications

The system is designed to handle complex pricing scenarios, multiple integrations, and provide a seamless experience from quote to order fulfillment.
