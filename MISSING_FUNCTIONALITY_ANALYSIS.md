# Missing Functionality Analysis: mc_portal_api vs autovista-api

This document lists functionality that exists in `mc_portal_api` but is NOT present in `autovista-api`.

## Order Module - Missing Functionality

### Missing Controllers/Routes

- `GET /order/:orderId/activities` - Get order activity log
- `POST /order/terms` - Accept order terms
- `POST /order/:orderId/status` - Get order status
- `POST /order/:orderId/location` - Request driver location
- `POST /order/customer` - Create order from customer (public endpoint)

---

## Quote Module - Missing Functionality

### Missing Routes

- `POST /quote/transport` - Update transport options
- `POST /quote/customer/find` - Find quote by customer info
- `POST /quote/customer` - Create quote customer
- `PUT /quote` - Update quote (alternative endpoint)

### Missing Services

- `calculateExistingQuoteRates.js` - Recalculate existing quote rates
- `calculateExistingQuoteWhiteGloveRates.js` - Recalculate white glove rates
- `calculateQuoteCustomRatesJK.js` - JK-specific custom rates

**Status**: Core quote functionality exists, but some advanced features missing

### Missing Utility Functions

- `calculateQuoteCustomRates.js` - Custom rate calculation
- `containsOnlyNumbers.js` - Number validation
- `isCanadianPostalCode.js` - Canadian postal code validation
- `saveQuoteToDB.js` - Quote saving utility
- `saveSDUpdatesToDB.js` - Super Dispatch update saving
- `toTitleCase.js` - String title case conversion
- `updateOrderFromSD.js` - Super Dispatch order update

---

## Summary Statistics

- **Complete Modules Missing**: 2 (Report, Email)
- **Partially Missing Modules**: 4 (Order, Quote, Auth, Portal)
- **Missing Routes**: ~10+ endpoints (reduced from ~40+ after recent implementations)
- **Missing Utilities**: ~7 utility functions (reduced from ~16 after identifying existing implementations)
- **Missing Scripts**: 0 (all requested scripts implemented and functional)
- **Missing Templates**: 0 (all templates added, some unused)

### High Priority (Business Critical)

1. **Order Activity Log** - Track order activity history
2. **Order Terms Acceptance** - Accept order terms endpoint
3. **Order Status Endpoint** - Get order status
4. **Driver Location Tracking** - Request driver location
5. **Public Customer Order Creation** - Create order from customer (public endpoint)
6. **Email Template Management** - Email customization API

### Medium Priority (Feature Parity)

1. **Additional Report Endpoints** - On-time, daily, annual reports (commission reports already implemented)

### Low Priority (Nice to Have)

1. **Additional Templates** - Email template variety
