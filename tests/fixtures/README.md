# Test Fixtures

This directory contains JSON fixture files for testing. These fixtures provide complete, realistic data structures that can be used directly in tests instead of complex factory functions.

## Available Fixtures

### `portal.json`

Complete portal data with:

- Valid `_id` field
- Contact information
- Address with coordinates
- Options configuration
- Custom rates
- All required fields for portal operations

### `globalModifierSet.json`

Global modifier set with:

- Valid `_id` field
- All modifier types (inoperable, fuel, IRR, etc.)
- Service level configurations
- Route and state modifiers
- Vehicle-specific modifiers

### `portalModifierSet.json`

Portal-specific modifier set with:

- Valid `_id` field
- Portal ID reference
- Enhanced modifier values
- Company tariff and commission settings
- All service level options

### `quote.json`

Complete quote data with:

- Valid `_id` field
- Customer information
- Origin and destination with coordinates
- Vehicle with complete pricing data
- Total pricing calculations
- All required fields for quote operations

## Usage

### Direct Loading

```typescript
import { getPortalFixture, getQuoteFixture } from "../utils/fixtures";

const portal = getPortalFixture();
const quote = getQuoteFixture();
```

### Factory Functions with Overrides

```typescript
import { createMockPortal, createMockQuote } from "../utils/fixtures";

const customPortal = createMockPortal({
  companyName: "Custom Company",
  status: "inactive",
});

const customQuote = createMockQuote({
  vehicles: [
    { make: "BMW", model: "X5" },
    { make: "Mercedes", model: "C-Class" },
  ],
});
```

### In Tests

```typescript
describe("Portal Service", () => {
  it("should create portal successfully", async () => {
    const portalData = getPortalFixture();
    const portal = await Portal.create(portalData);

    expect(portal._id).toBeDefined();
    expect(portal.companyName).toBe("Test Auto Transport Co");
  });
});
```

## Benefits

1. **Realistic Data**: Fixtures contain complete, realistic data structures
2. **Consistent IDs**: All fixtures have valid `_id` fields for database operations
3. **Easy to Use**: Simple import and use - no complex factory logic
4. **Maintainable**: Easy to update fixture data when schemas change
5. **Reliable**: No random data generation that could cause flaky tests
6. **Complete**: All required fields are included with sensible defaults

## Adding New Fixtures

1. Create a new JSON file in this directory
2. Include all required fields with realistic data
3. Add a corresponding loader function in `../utils/fixtures.ts`
4. Update this README with the new fixture description

## Schema Validation

All fixtures are designed to pass schema validation. If you encounter validation errors:

1. Check that all required fields are present
2. Verify field types match schema expectations
3. Ensure nested objects have the correct structure
4. Update the fixture file to match current schema requirements
