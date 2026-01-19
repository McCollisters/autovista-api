# Quote to Order Flow (Current)

Updated to reflect the current API flow and schema behavior.

## Overview

The Autovista API uses a two-stage flow:

1. **Quote Creation**: Origin/destination + vehicles are priced and saved as a quote.
2. **Order Creation**: A quote is converted into an order with scheduling, contact, and address details, and optionally pushed to Super Dispatch.

## Endpoints

### Quote endpoints

- `POST /api/v1/quote` (authenticated)  
  Controller: `src/quote/controllers/createQuote.ts`  
  Validation: `src/quote/middleware/validateQuoteBody.ts`

- `POST /api/v1/quote/customer` (public customer quote)  
  Controller: `src/quote/controllers/createQuoteCustomer.ts`

- `GET /api/v1/quote/public/:quoteId/app` (public quote view)  
  Controller: `src/quote/controllers/getQuote.ts`

### Order endpoints

- `POST /api/v1/order` (authenticated)  
  Controller: `src/order/controllers/createOrder.ts`

- `POST /api/v1/order/customer` (public customer order)  
  Controller: `src/order/controllers/createOrderCustomer.ts`

---

## Part 1: Quote Creation (Authenticated)

**Endpoint**: `POST /api/v1/quote`  
**Controller**: `src/quote/controllers/createQuote.ts`

### Request shape (current)

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
      "pricingClass": "Sedan",
      "isInoperable": false
    }
  ],
  "commission": 0
}
```

### Flow summary

1. **Validation**  
   `validateQuoteBody` requires:
   - `origin` (string)
   - `destination` (string)
   - `portal`/`portalId` (string)
   - `vehicles[]` with `make` + `model`  
   Optional: `user`/`userId`

2. **De-dupe existing quotes**  
   `matchesExistingQuote` returns a prior quote if the same portal, origin/destination, vehicles, and commission exist.  
   If returned quote is missing `transitTime`, it is backfilled from settings.

3. **Portal lookup**  
   `Portal.findById(portalId)` must exist.

4. **Location validation**  
   `validateLocation(origin|destination)` normalizes:
   - `validated` string
   - `state` code

5. **Geocoding + mileage**  
   `getCoordinates()` + `getMiles()` produce `originCoords`, `destinationCoords`, and `miles`.

6. **Transit time**  
   `getTransitTimeFromSettings()` uses `Settings.transitTimes` and `miles`. If unavailable, a safe fallback is used.

7. **Vehicle normalization**  
   Vehicles are normalized so that:
   - `make`/`model` objects become strings
   - `isInoperable` is derived from `operable` when needed
   - `pricingClass` is preserved or inferred from model metadata

8. **Pricing**  
   - `updateVehiclesWithPricing()` applies portal rates/modifiers
   - `calculateTotalPricing()` summarizes totals

9. **Persist quote**  
   Quote is saved with structured origin/destination and pricing totals.

---

## Part 1b: Quote Creation (Public Customer)

**Endpoint**: `POST /api/v1/quote/customer`  
**Controller**: `src/quote/controllers/createQuoteCustomer.ts`

### Request shape (current)

```json
{
  "portalId": "portal_id_here",
  "customerFullName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "pickup": "Boston, MA",
  "delivery": "Los Angeles, CA",
  "vehicles": [
    { "make": "Honda", "model": "Civic", "isInoperable": false }
  ],
  "transportType": "OPEN"
}
```

### Flow summary

1. Validates `pickup`, `delivery`, and `vehicles[]`.  
   Zip-only values must be 5 digits.

2. Generates a customer tracking code via `nanoid()` and sets:
   - `quote.isCustomerPortal = true`
   - `customer.trackingCode`

3. Uses the same pricing pipeline as authenticated quotes:
   - `validateLocation`, `getCoordinates`, `getMiles`
   - `updateVehiclesWithPricing`, `calculateTotalPricing`

---

## Quote Schema Highlights

Source: `src/quote/schema.ts`

- `customer` is an object (`name`, `email`, `phone`, `trackingCode`)
- `origin` / `destination` are objects:
  - `userInput`, `validated`, `state`, `coordinates { long, lat }`
- `vehicles[]` include:
  - `isInoperable`, `pricingClass`
  - `pricing` breakdown (base, modifiers, totals by service level)
- `totalPricing` aggregates per-quote totals

---

## Part 2: Order Creation (Authenticated)

**Endpoint**: `POST /api/v1/order`  
**Controller**: `src/order/controllers/createOrder.ts`

### Request shape (current)

```json
{
  "quoteId": "quote_id_here",
  "portalId": "portal_id_here",
  "customerFullName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPrimaryPhone": "555-1234",
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
    { "vin": "4T1BF1FK5EU123456", "year": "2020" }
  ],
  "agents": [{ "name": "Agent", "email": "agent@example.com" }]
}
```

### Flow summary

1. **Defaults + coercions**
   - `paymentType` can be a string or `{ value }`
   - `payment` defaults to **Billing** but becomes **COD** for specific portals or White Glove
   - `moveType` defaults to `"other"`
   - `pickupLocationType` defaults to `"Residence"`

2. **Required fields**  
   `portalId`, `quoteId`, and `pickupStartDate` are required.

3. **DB lookups**
   - Load `portal` and `quote`
   - `quote.status` is set to `Booked`

4. **Transport type normalization**
   `transportType` is normalized to `OPEN`, `ENCLOSED`, or `WHITEGLOVE`.

5. **Address fallback**
   If pickup/delivery address parts are missing, they are parsed from the quote's
   `origin` / `destination` values.

6. **Geocode**
   `geocode()` converts pickup and delivery addresses into coordinates.

7. **Customer/contact normalization**
   - Names/emails merged across request + quote
   - `formatPhoneNumber()` normalizes phone fields
   - Mobile vs. landline is derived from `*_IsMobile` flags

8. **Transit time + service level**
   - `transitTime` is validated and backfilled from settings if missing
   - `serviceLevel` is normalized to a number
   - `getDateRanges()` produces pickup/delivery windows
   - White Glove uses `ServiceLevelOption.WhiteGlove`

9. **Vehicle merge**
   - The order’s vehicles come from the original quote
   - `quotes[]` in the request can override VIN/year only
   - Pricing data is preserved from the quote

10. **Super Dispatch (partial order)**
    A partial order (addresses withheld) is sent to Super Dispatch when:
    - not a customer portal order
    - payment is not COD
    - transport is not White Glove

11. **Order persistence**
    An `Order` document is created with:
    - normalized customer/contact data
    - `origin` + `destination` structured objects
    - schedule windows
    - vehicles + pricing
    - `tms` metadata (when present)

12. **Notifications**
    - Agent notifications
    - White Glove notification
    - COD payment instructions
    - Customer confirmation email

---

## Part 2b: Order Creation (Public Customer)

**Endpoint**: `POST /api/v1/order/customer`  
**Controller**: `src/order/controllers/createOrderCustomer.ts`

This endpoint sets `isCustomerPortal = true` and delegates to the same
`createOrder` logic, including email sending.

---

## Order Schema Highlights

Source: `src/order/schema.ts`

- `customer` is a contact object (`name`, `email`, `phone`, `phoneMobile`)
- `origin` / `destination` include:
  - `contact`, `address`, `notes`, `longitude`, `latitude`
- `vehicles[]` contain pricing details and totals
- `schedule` stores pickup/delivery window dates
- `tms` stores Super Dispatch metadata

---

## Post-Order Updates & Integrations

Key files:

- `src/order/integrations/sendPartialOrderToSuper.ts`
- `src/order/integrations/updateOrderFromSD.ts`

Super Dispatch updates are merged back into the order (status, schedule,
vehicle totals, and address updates) when external data is received.

