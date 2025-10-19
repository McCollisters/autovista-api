import fs from "fs";
import path from "path";

const fixturesDir = path.join(__dirname, "../fixtures");

/**
 * Load a JSON fixture file
 */
export const loadFixture = <T = any>(filename: string): T => {
  const filePath = path.join(fixturesDir, filename);
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
};

/**
 * Load portal fixture data
 */
export const getPortalFixture = () => loadFixture("portal.json");

/**
 * Load global modifier set fixture data
 */
export const getGlobalModifierSetFixture = () =>
  loadFixture("globalModifierSet.json");

/**
 * Load portal modifier set fixture data
 */
export const getPortalModifierSetFixture = () =>
  loadFixture("portalModifierSet.json");

/**
 * Load quote fixture data
 */
export const getQuoteFixture = () => loadFixture("quote.json");

/**
 * Create a mock portal with optional overrides
 */
export const createMockPortal = (overrides: Partial<any> = {}) => ({
  ...getPortalFixture(),
  ...overrides,
});

/**
 * Create a mock global modifier set with optional overrides
 */
export const createMockGlobalModifierSet = (overrides: Partial<any> = {}) => ({
  ...getGlobalModifierSetFixture(),
  ...overrides,
});

/**
 * Create a mock portal modifier set with optional overrides
 */
export const createMockPortalModifierSet = (overrides: Partial<any> = {}) => ({
  ...getPortalModifierSetFixture(),
  ...overrides,
});

/**
 * Create a mock quote with optional overrides
 */
export const createMockQuote = (overrides: Partial<any> = {}) => ({
  ...getQuoteFixture(),
  ...overrides,
});

/**
 * Create a mock vehicle with optional overrides
 */
export const createMockVehicle = (overrides: Partial<any> = {}) => ({
  make: "Toyota",
  model: "Camry",
  year: "2020",
  vin: "1HGBH41JXMN109186",
  isInoperable: false,
  isOversize: false,
  transportType: "open",
  pricingClass: "sedan",
  ...overrides,
});
