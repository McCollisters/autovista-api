# Test Coverage Tracking

This document tracks test coverage for all services, controllers, and utilities in the Autovista API. It's organized by service/module and indicates which components have tests and which need to be implemented.

## Test Pattern

Tests follow this structure:
- **Unit Tests**: Test individual functions in isolation with mocks
- **Integration Tests**: Test complete workflows with database operations
- **Location**: `tests/{module}/{type}/{filename}.test.ts`
- **Pattern**: Use `describe` blocks for grouping, `it` blocks for individual tests
- **Mocks**: Mock external dependencies (models, integrations, APIs)
- **Fixtures**: Use test data factories from `tests/utils/testDataFactory.ts`

## Coverage Status Legend

- ✅ **Has Tests** - Tests exist and are passing
- ⚠️ **Partial Tests** - Some tests exist but coverage is incomplete
- ❌ **No Tests** - No tests exist yet
- 🔄 **In Progress** - Tests are being implemented

---

## Core Services

### Quote Service

**Location**: `src/quote/`

#### Controllers

| Controller | Status | Test File | Notes |
|------------|--------|-----------|-------|
| `createQuote.ts` | ⚠️ Partial | `tests/quote/controllers/createQuote.integration.test.ts` | Integration test only |
| `getQuote.ts` | ✅ | `tests/quote/controllers/getQuote.test.ts` | Unit tests with error handling |
| `getQuotes.ts` | ❌ | - | No tests |
| `updateQuote.ts` | ❌ | - | No tests |
| `deleteQuote.ts` | ❌ | - | No tests |
| `updateTransportOptions.ts` | ❌ | - | No tests |
| `findQuoteCustomer.ts` | ❌ | - | No tests |
| `createQuoteCustomer.ts` | ❌ | - | No tests |
| `updateQuoteAlternative.ts` | ❌ | - | No tests |

#### Services

| Service | Status | Test File | Notes |
|---------|--------|-----------|-------|
| `calculateTotalPricing.ts` | ✅ | `tests/quote/services/calculateTotalPricing.test.ts` | Comprehensive tests |
| `getMiles.ts` | ✅ | `tests/quote/services/getMiles.test.ts` | Unit tests |
| `getMiles.ts` | ✅ | `tests/quote/services/getMiles.integration.test.ts` | Integration tests |
| `matchesExistingQuote.ts` | ✅ | `tests/quote/services/matchesExistingQuote.test.ts` | Unit tests |
| `matchesExistingQuote.ts` | ✅ | `tests/quote/services/matchesExistingQuote.integration.test.ts` | Integration tests |
| `recalculateExistingQuote.ts` | ❌ | - | No tests |
| `updateVehiclesWithPricing.ts` | ✅ | `tests/quote/services/updateVehiclesWithPricing.test.ts` | Comprehensive tests |
| `validateLocation.ts` | ✅ | `tests/quote/services/validateLocation.test.ts` | Unit tests |
| `validateLocation.ts` | ✅ | `tests/quote/services/validateLocation.integration.test.ts` | Integration tests |

#### Integrations

| Integration | Status | Test File | Notes |
|-------------|--------|-----------|-------|
| `getTMSBaseRate.ts` | ❌ | - | No tests (external API) |
| `getCustomBaseRate.ts` | ❌ | - | No tests |
| `getJKBaseRate.ts` | ❌ | - | No tests |

#### Utils

| Utility | Status | Test File | Notes |
|---------|--------|-----------|-------|
| `pricingCalculations.ts` | ✅ | `tests/quote/utils/pricingCalculations.test.ts` | Utility tests |

#### Integration Tests

| Test | Status | Test File | Notes |
|------|--------|-----------|-------|
| Quote Flow E2E | ✅ | `tests/integration/quoteFlow.test.ts` | End-to-end quote creation |

---

### Order Service

**Location**: `src/order/`

#### Controllers

| Controller | Status | Test File | Notes |
|------------|--------|-----------|-------|
| `createOrder.ts` | ⚠️ Partial | `tests/order/controllers/createOrder.test.ts` | Basic tests, needs more coverage |
| `getOrder.ts` | ❌ | - | No tests |
| `getOrders.ts` | ✅ | `tests/order/controllers/getOrders.test.ts` | Unit tests with error handling |
| `updateOrder.ts` | ❌ | - | No tests |
| `deleteOrder.ts` | ❌ | - | No tests |
| `requestTrackOrder.ts` | ❌ | - | No tests |
| `getOrderStatus.ts` | ❌ | - | No tests |
| `requestDriverLocation.ts` | ❌ | - | No tests |
| `getOrderActivities.ts` | ❌ | - | No tests |
| `addOrderFiles.ts` | ❌ | - | No tests |
| `removeOrderFile.ts` | ❌ | - | No tests |
| `getCommissionReports.ts` | ❌ | - | No tests |
| `exportOrders.ts` | ❌ | - | No tests |
| `getOrdersAnalytics.ts` | ❌ | - | No tests |
| `acceptOrderTerms.ts` | ❌ | - | No tests |
| `createOrderCustomer.ts` | ❌ | - | No tests |

#### Services

| Service | Status | Test File | Notes |
|---------|--------|-----------|-------|
| `formatOrderForSD.ts` | ❌ | - | No tests |
| `formatOrderTotalPricing.ts` | ❌ | - | No tests |
| `getDeliveryRanges.ts` | ✅ | `tests/order/services/getDeliveryRanges.test.ts` | Comprehensive date calculation tests |
| `getServiceLevelValue.ts` | ❌ | - | No tests |
| `sendOrderToSD.ts` | ❌ | - | No tests (external API) |
| `updateVehiclesWithQuote.ts` | ❌ | - | No tests |

#### Integrations

| Integration | Status | Test File | Notes |
|-------------|--------|-----------|-------|
| `acertusClient.ts` | ❌ | - | No tests (external API) |
| `sendOrderToSuper.ts` | ❌ | - | No tests (external API) |
| `sendPartialOrderToSuper.ts` | ❌ | - | No tests (external API) |
| `updateOrderFromSD.ts` | ❌ | - | No tests |
| `updateSuperWithCompleteOrder.ts` | ❌ | - | No tests (external API) |
| `saveSDUpdatesToDB.ts` | ❌ | - | No tests |

#### Notifications

| Notification | Status | Test File | Notes |
|--------------|--------|-----------|-------|
| `sendOrderCustomerPublicNew.ts` | ❌ | - | No tests |
| `sendOrderPickupConfirmation.ts` | ❌ | - | No tests |
| `sendOrderDeliveryConfirmation.ts` | ❌ | - | No tests |
| `sendOrderCustomerSignatureRequest.ts` | ❌ | - | No tests |
| `sendTrackOrderConfirmation.ts` | ❌ | - | No tests |
| `sendTrackOrderNotification.ts` | ❌ | - | No tests |
| `sendCODPaymentRequest.ts` | ❌ | - | No tests |
| `sendWhiteGloveNotification.ts` | ❌ | - | No tests |
| `sendMMIOrderNotification.ts` | ❌ | - | No tests |
| `sendOrderAgent.ts` | ❌ | - | No tests |
| `requestSignature.ts` | ❌ | - | No tests |
| `sendSurvey.ts` | ❌ | - | No tests |

#### Utils

| Utility | Status | Test File | Notes |
|---------|--------|-----------|-------|
| `checkWithheldAddress.ts` | ❌ | - | No tests |

---

### Survey Service

**Location**: `src/survey/`

#### Controllers

| Controller | Status | Test File | Notes |
|------------|--------|-----------|-------|
| `controller.ts` (createSurvey) | ❌ | - | No tests |
| `getSurveys.ts` | ❌ | - | No tests |
| `getSurveysByPortal.ts` | ❌ | - | No tests |
| `getSurveyPortalResults.ts` | ❌ | - | No tests |
| `exportSurveys.ts` | ❌ | - | No tests |

---

### Survey Response Service

**Location**: `src/surveyResponse/`

#### Controllers

| Controller | Status | Test File | Notes |
|------------|--------|-----------|-------|
| `controller.ts` | ❌ | - | No tests |

---

## Supporting Services

### Authentication Service

**Location**: `src/auth/`

#### Controllers

| Controller | Status | Test File | Notes |
|------------|--------|-----------|-------|
| `verifyEmail2FA.ts` | ❌ | - | No tests |
| `loginEmail2FA.ts` | ❌ | - | No tests |
| `authenticateApiUser.ts` | ❌ | - | No tests |
| `loginSocial.ts` | ❌ | - | No tests |

#### Services

| Service | Status | Test File | Notes |
|---------|--------|-----------|-------|
| `sendVerificationEmail.ts` | ❌ | - | No tests |

---

### User Service

**Location**: `src/user/`

#### Controllers

| Controller | Status | Test File | Notes |
|------------|--------|-----------|-------|
| `createUser.ts` | ❌ | - | No tests |
| `createUserAdmin.ts` | ❌ | - | No tests |
| `getUser.ts` | ❌ | - | No tests |
| `getAuthorizedUser.ts` | ❌ | - | No tests |
| `getUsers.ts` | ❌ | - | No tests |
| `getUsersByPortal.ts` | ❌ | - | No tests |
| `updateUser.ts` | ❌ | - | No tests |
| `deleteUser.ts` | ❌ | - | No tests |

---

### Portal Service

**Location**: `src/portal/`

#### Controllers

| Controller | Status | Test File | Notes |
|------------|--------|-----------|-------|
| `createPortal.ts` | ❌ | - | No tests |
| `getPortal.ts` | ❌ | - | No tests |
| `getPortals.ts` | ❌ | - | No tests |
| `updatePortal.ts` | ❌ | - | No tests |
| `deletePortal.ts` | ❌ | - | No tests |

---

### Brand Service

**Location**: `src/brand/`

#### Controllers

| Controller | Status | Test File | Notes |
|------------|--------|-----------|-------|
| `controller.ts` (createBrand) | ❌ | - | No tests |
| `getMakes.ts` | ❌ | - | No tests |

---

### Modifier Set Service

**Location**: `src/modifierSet/`

#### Controllers

| Controller | Status | Test File | Notes |
|------------|--------|-----------|-------|
| `controller.ts` (CRUD operations) | ❌ | - | No tests |

---

### Settings Service

**Location**: `src/settings/`

#### Controllers

| Controller | Status | Test File | Notes |
|------------|--------|-----------|-------|
| `getSettings.ts` | ❌ | - | No tests |
| `updateSettings.ts` | ❌ | - | No tests |
| `getCustomerSettings.ts` | ❌ | - | No tests |

---

## Infrastructure Services

### Notification System

**Location**: `src/notification/`

#### Core Components

| Component | Status | Test File | Notes |
|-----------|--------|-----------|-------|
| `manager.ts` | ❌ | - | No tests |
| `email.ts` | ❌ | - | No tests |
| `sms.ts` | ❌ | - | No tests |
| `orderNotifications.ts` | ❌ | - | No tests |
| `sendManualEmail.ts` | ❌ | - | No tests |
| `sendCarriers.ts` | ❌ | - | No tests |

#### Controllers

| Controller | Status | Test File | Notes |
|------------|--------|-----------|-------|
| (Notification routes) | ❌ | - | No tests |

---

### Email Service

**Location**: `src/email/`

#### Controllers

| Controller | Status | Test File | Notes |
|------------|--------|-----------|-------|
| `getEmailTemplates.ts` | ❌ | - | No tests |
| `getEmailTemplate.ts` | ❌ | - | No tests |
| `updateEmailTemplate.ts` | ❌ | - | No tests |

#### Services

| Service | Status | Test File | Notes |
|---------|--------|-----------|-------|
| `getEmailTemplate.ts` | ❌ | - | No tests |

---

### Integration Utilities

**Location**: `src/integration/`

#### Controllers

| Controller | Status | Test File | Notes |
|------------|--------|-----------|-------|
| `signS3.ts` | ❌ | - | No tests (AWS integration) |
| `getFile.ts` | ❌ | - | No tests (AWS integration) |
| `captivatedCallback.ts` | ❌ | - | No tests |

---

## Global Utilities

**Location**: `src/_global/`

### Utils

| Utility | Status | Test File | Notes |
|---------|--------|-----------|-------|
| `location.ts` | ✅ | `tests/_global/utils/location.test.ts` | Unit tests |
| `location.ts` | ✅ | `tests/_global/utils/location.integration.test.ts` | Integration tests |
| `geocode.ts` | ❌ | - | No tests |
| `getDateRanges.ts` | ❌ | - | No tests |
| `formatPhoneNumber.ts` | ❌ | - | No tests |
| `createToken.ts` | ❌ | - | No tests |
| `getUserFromToken.ts` | ❌ | - | No tests |
| `roundCurrency.ts` | ❌ | - | No tests |
| `toTitleCase.ts` | ❌ | - | No tests |
| `containsOnlyNumbers.ts` | ❌ | - | No tests |
| `id.ts` | ❌ | - | No tests |

### Integrations

| Integration | Status | Test File | Notes |
|-------------|--------|-----------|-------|
| `authenticateSuperDispatch.ts` | ❌ | - | No tests (external API) |
| `webhooks/registry.ts` | ❌ | - | No tests |
| `webhooks/handlers.ts` | ❌ | - | No tests |
| `webhooks/middleware.ts` | ❌ | - | No tests |
| `webhooks/callbacks.ts` | ❌ | - | No tests |
| `webhooks/index.ts` | ❌ | - | No tests |
| `webhooks/types.ts` | ❌ | - | No tests (types only) |

### Core

| Component | Status | Test File | Notes |
|-----------|--------|-----------|-------|
| `logger.ts` | ❌ | - | No tests (logging utility) |
| `cron.ts` | ❌ | - | No tests |
| `middleware/security.ts` | ❌ | - | No tests |

---

## Presentation Routes

**Location**: `src/presentation/`

| Route | Status | Test File | Notes |
|-------|--------|-----------|-------|
| `health.ts` | ❌ | - | No tests |

---

## Test Coverage Summary

### By Category

| Category | Total | ✅ Has Tests | ⚠️ Partial | ❌ No Tests | Coverage % |
|----------|-------|--------------|------------|-------------|------------|
| **Quote Controllers** | 9 | 1 | 1 | 7 | 22% |
| **Quote Services** | 6 | 5 | 0 | 1 | 83% |
| **Quote Integrations** | 3 | 0 | 0 | 3 | 0% |
| **Order Controllers** | 15 | 1 | 1 | 13 | 13% |
| **Order Services** | 6 | 1 | 0 | 5 | 17% |
| **Order Integrations** | 6 | 0 | 0 | 6 | 0% |
| **Order Notifications** | 12 | 0 | 0 | 12 | 0% |
| **Survey Controllers** | 5 | 0 | 0 | 5 | 0% |
| **Survey Response** | 1 | 0 | 0 | 1 | 0% |
| **Auth Controllers** | 4 | 0 | 0 | 4 | 0% |
| **User Controllers** | 8 | 0 | 0 | 8 | 0% |
| **Portal Controllers** | 5 | 0 | 0 | 5 | 0% |
| **Brand Controllers** | 2 | 0 | 0 | 2 | 0% |
| **ModifierSet Controllers** | 5 | 0 | 0 | 5 | 0% |
| **Settings Controllers** | 3 | 0 | 0 | 3 | 0% |
| **Notification Components** | 6 | 0 | 0 | 6 | 0% |
| **Email Controllers** | 3 | 0 | 0 | 3 | 0% |
| **Integration Controllers** | 3 | 0 | 0 | 3 | 0% |
| **Global Utils** | 10 | 2 | 0 | 8 | 20% |
| **Global Integrations** | 7 | 0 | 0 | 7 | 0% |
| **Core Components** | 3 | 0 | 0 | 3 | 0% |
| **Presentation Routes** | 1 | 0 | 0 | 1 | 0% |
| **TOTAL** | **123** | **10** | **2** | **111** | **~10%** |

### Priority Areas for Testing

1. **High Priority** (Core Business Logic):
   - Order Service (controllers, services, integrations)
   - Quote Controllers (get, update, delete operations)
   - Order Notifications (critical for customer communication)

2. **Medium Priority** (Supporting Features):
   - User Service (authentication and user management)
   - Portal Service (configuration management)
   - Settings Service (system configuration)
   - Survey Service (customer feedback)

3. **Lower Priority** (Utilities & Infrastructure):
   - Global utilities (geocode, date ranges, etc.)
   - Integration utilities (S3, Captivated)
   - Core infrastructure (logger, cron, middleware)

---

## Test Implementation Guidelines

### Following the Existing Pattern

1. **File Structure**:
   ```
   tests/
   ├── {module}/
   │   ├── controllers/
   │   │   └── {controllerName}.test.ts
   │   ├── services/
   │   │   └── {serviceName}.test.ts
   │   ├── integrations/
   │   │   └── {integrationName}.test.ts
   │   └── utils/
   │       └── {utilityName}.test.ts
   ```

2. **Test Structure**:
   ```typescript
   import { describe, it, expect, beforeEach, jest } from "@jest/globals";
   import { functionToTest } from "@/module/path/to/function";
   import { createMockX } from "@tests/utils/testDataFactory";
   import { mockRequest, mockResponse, mockNext } from "@tests/utils/mockHelpers";

   // Mock external dependencies
   jest.mock("@/_global/models");
   jest.mock("@/module/integrations/externalAPI");

   describe("functionToTest", () => {
     beforeEach(() => {
       jest.clearAllMocks();
       // Setup mocks
     });

     describe("Basic Functionality", () => {
       it("should handle basic case", async () => {
         // Arrange
         const input = createMockX();
         
         // Act
         const result = await functionToTest(input);
         
         // Assert
         expect(result).toBeDefined();
         expect(result).toHaveProperty("expectedProperty");
       });
     });

     describe("Edge Cases", () => {
       it("should handle empty input", async () => {
         // Test edge case
       });
     });

     describe("Error Handling", () => {
       it("should handle errors gracefully", async () => {
         // Test error cases
       });
     });
   });
   ```

3. **Mocking Strategy**:
   - Mock Mongoose models at the module level
   - Mock external API calls (Super Dispatch, Acertus, etc.)
   - Use test data factories for consistent test data
   - Clear mocks between tests

4. **Test Categories**:
   - **Unit Tests**: Test individual functions in isolation
   - **Integration Tests**: Test complete workflows with database
   - **Edge Cases**: Test boundary conditions, empty inputs, null values
   - **Error Handling**: Test error scenarios and validation

---

## Next Steps

### Immediate Priorities

1. **Order Service Tests** (High Priority):
   - `getOrder.test.ts`
   - `getOrders.test.ts`
   - `updateOrder.test.ts`
   - `getOrderStatus.test.ts`
   - `getOrderActivities.test.ts`

2. **Quote Controller Tests** (High Priority):
   - `getQuote.test.ts`
   - `getQuotes.test.ts`
   - `updateQuote.test.ts`
   - `deleteQuote.test.ts`

3. **Order Service Tests** (High Priority):
   - `formatOrderForSD.test.ts`
   - `getDeliveryRanges.test.ts`
   - `updateVehiclesWithQuote.test.ts`

4. **Global Utilities** (Medium Priority):
   - `geocode.test.ts`
   - `getDateRanges.test.ts`
   - `formatPhoneNumber.test.ts`

### Test Implementation Order

1. ✅ Quote Services (mostly complete)
2. 🔄 Order Controllers (started, needs completion)
3. ❌ Order Services (next priority)
4. ❌ Quote Controllers (get, update, delete)
5. ❌ User Service (authentication flows)
6. ❌ Portal Service (configuration management)
7. ❌ Global Utilities (helper functions)

---

## Notes

- **External API Tests**: Tests for Super Dispatch, Acertus, and other external APIs should mock the API calls rather than making real requests
- **Database Tests**: Use MongoDB Memory Server for isolated database tests
- **Integration Tests**: Use real database operations but with test data
- **Coverage Goals**: Aim for >90% coverage on business logic, >80% overall

---

## Updating This Document

When adding new tests:
1. Update the status from ❌ to ✅ or ⚠️
2. Add the test file path
3. Update the coverage summary table
4. Note any special considerations in the Notes column

