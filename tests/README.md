# Testing Documentation

This directory contains comprehensive test suites for the Autovista API, focusing on the quote pricing functionality.

## Test Structure

```
tests/
├── setup.ts                    # Global test setup and teardown
├── utils/                      # Test utilities and helpers
│   ├── testDataFactory.ts      # Mock data creation utilities
│   └── mockHelpers.ts          # Mock functions and helpers
├── quote/                      # Quote-specific tests
│   ├── services/               # Service layer tests
│   │   ├── updateVehiclesWithPricing.test.ts
│   │   └── calculateTotalPricing.test.ts
│   ├── controllers/            # Controller tests
│   │   └── createQuote.test.ts
│   └── utils/                  # Utility function tests
│       └── pricingCalculations.test.ts
├── integration/                # Integration tests
│   └── quoteFlow.test.ts
└── fixtures/                   # Test data fixtures
```

## Running Tests

### All Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

### CI Mode

```bash
npm run test:ci
```

## Test Categories

### Unit Tests

- **Service Tests**: Test individual service functions in isolation
- **Controller Tests**: Test API endpoints and request/response handling
- **Utility Tests**: Test helper functions and calculations

### Integration Tests

- **End-to-End Flow**: Test complete quote creation workflow
- **Database Integration**: Test with real database operations
- **Data Consistency**: Verify data integrity across operations

## Test Utilities

### testDataFactory.ts

Provides factory functions to create consistent mock data:

- `createMockVehicle()` - Create test vehicle objects
- `createMockQuote()` - Create test quote objects
- `createMockModifierSet()` - Create test modifier sets
- `createMockPortal()` - Create test portal objects
- `createMockPricingData()` - Create test pricing data

### mockHelpers.ts

Provides mock functions and utilities:

- `mockMongooseModel()` - Mock Mongoose models
- `mockRequest()` - Mock Express request objects
- `mockResponse()` - Mock Express response objects
- `mockNext()` - Mock Express next function
- `createMockWithOverrides()` - Create mocks with custom overrides

## Test Database

Tests use MongoDB Memory Server for isolated, fast database operations:

- Each test runs with a fresh database instance
- No external database dependencies
- Automatic cleanup after each test
- Parallel test execution support

## Coverage Goals

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

## Writing New Tests

### 1. Unit Test Example

```typescript
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { functionToTest } from "../../../src/path/to/function.js";

describe("functionToTest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle basic case", () => {
    const result = functionToTest(input);
    expect(result).toBe(expectedOutput);
  });
});
```

### 2. Integration Test Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Model } from "../../../src/path/to/model.js";

describe("Integration Test", () => {
  beforeAll(async () => {
    // Setup test data
  });

  afterAll(async () => {
    // Cleanup test data
  });

  it("should perform end-to-end operation", async () => {
    // Test complete workflow
  });
});
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Mocking**: Mock external dependencies
4. **Descriptive Names**: Use clear, descriptive test names
5. **Single Responsibility**: Each test should test one thing
6. **Arrange-Act-Assert**: Structure tests clearly
7. **Edge Cases**: Test boundary conditions and error cases

## Debugging Tests

### Run Specific Test

```bash
npm test -- --testNamePattern="specific test name"
```

### Run Specific File

```bash
npm test -- updateVehiclesWithPricing.test.ts
```

### Debug Mode

```bash
npm test -- --detectOpenHandles --forceExit
```

## Common Issues

### Memory Leaks

- Ensure proper cleanup in `afterEach`/`afterAll`
- Close database connections
- Clear timers and intervals

### Async Operations

- Use `await` for async operations
- Handle promises properly
- Use appropriate timeouts

### Mock Issues

- Clear mocks between tests
- Verify mock calls
- Reset mock implementations

## Contributing

When adding new tests:

1. Follow the existing structure
2. Use the provided utilities
3. Add appropriate documentation
4. Ensure good coverage
5. Test edge cases and error conditions
