import {
  ServiceLevelOption,
  TransportType,
  VehicleClass,
} from "@/_global/enums";
import {
  getPortalFixture,
  getGlobalModifierSetFixture,
  getQuoteFixture,
} from "./fixtures";

export const createMockVehicle = (overrides: any = {}) => ({
  year: "2020", // Changed to string to match schema
  make: "Toyota",
  model: "Camry",
  vin: "1HGBH41JXMN109186",
  isInoperable: false,
  isOversize: false,
  transportType: TransportType.Open,
  pricingClass: VehicleClass.Sedan,
  ...overrides,
});

export const createMockQuote = (overrides: any = {}) => ({
  quoteNumber: "Q-12345",
  status: "active",
  portalId: new (require("mongoose").Types.ObjectId)(), // Use proper ObjectId
  userId: new (require("mongoose").Types.ObjectId)(), // Use proper ObjectId
  customer: {
    name: "Test Customer",
    email: "test@example.com",
    phone: "555-1234",
  },
  vehicles: [createMockVehicle()],
  ...overrides,
});

export const createMockModifierSet = (overrides: any = {}) => ({
  name: "Test Modifier Set",
  isGlobal: true,
  inoperable: { valueType: "flat", value: 500 },
  routes: [
    { origin: "CA", destination: "NY", valueType: "flat", value: 0 },
    { origin: "NY", destination: "CA", valueType: "flat", value: 0 },
    { origin: "TX", destination: "CA", valueType: "flat", value: 0 },
  ],
  states: {
    CA: { direction: "both", valueType: "flat", value: 0 },
    NY: { direction: "both", valueType: "flat", value: 0 },
    TX: { direction: "both", valueType: "flat", value: 0 },
  },
  oversize: {
    suv: 200,
    van: 300,
    pickup_2_doors: 150,
    pickup_4_doors: 250,
    sedan: 1000,
  },
  vehicles: [
    { makeModel: ["Toyota", "Camry"], valueType: "flat", value: 0 },
    { makeModel: ["Honda", "Civic"], valueType: "flat", value: 0 },
  ],
  discount: { valueType: "flat", value: 0 },
  irr: { valueType: "flat", value: 0 },
  fuel: { valueType: "flat", value: 0 },
  enclosedFlat: { valueType: "flat", value: 500 },
  enclosedPercent: { valueType: "percent", value: 10 },
  commission: { valueType: "percent", value: 5 },
  serviceLevels: [
    { serviceLevelOption: ServiceLevelOption.OneDay, value: 1000 },
    { serviceLevelOption: ServiceLevelOption.ThreeDay, value: 800 },
    { serviceLevelOption: ServiceLevelOption.FiveDay, value: 600 },
    { serviceLevelOption: ServiceLevelOption.SevenDay, value: 400 },
    { serviceLevelOption: ServiceLevelOption.WhiteGlove, value: 2000 },
  ],
  whiteGlove: { multiplier: 2, minimum: 1000 },
  companyTariffDiscount: { valueType: "percent", value: 10 },
  companyTariffEnclosedFee: { valueType: "flat", value: 200 },
  ...overrides,
});

export const createMockPortal = (overrides: any = {}) => ({
  ...getPortalFixture(),
  ...overrides,
});

export const createMockPricingData = () => ({
  base: 1000,
  modifiers: {
    inoperable: 0,
    routes: 0,
    states: 0,
    oversize: 0,
    vehicles: 0,
    globalDiscount: 0,
    portalDiscount: 0,
    irr: 0,
    fuel: 0,
    enclosedFlat: 0,
    enclosedPercent: 0,
    commission: 50,
    serviceLevels: [
      { serviceLevelOption: ServiceLevelOption.OneDay, value: 1000 },
      { serviceLevelOption: ServiceLevelOption.ThreeDay, value: 800 },
      { serviceLevelOption: ServiceLevelOption.FiveDay, value: 600 },
      { serviceLevelOption: ServiceLevelOption.SevenDay, value: 400 },
      { serviceLevelOption: ServiceLevelOption.WhiteGlove, value: 2000 },
    ],
    companyTariffs: [],
  },
  totals: {
    whiteGlove: 2000,
    one: {
      open: {
        total: 1000,
        companyTariff: 150,
        commission: 50,
        totalWithCompanyTariffAndCommission: 1200,
      },
      enclosed: {
        total: 1100,
        companyTariff: 165,
        commission: 50,
        totalWithCompanyTariffAndCommission: 1315,
      },
    },
    three: {
      total: 800,
      companyTariff: 120,
      commission: 50,
      totalWithCompanyTariffAndCommission: 970,
    },
    five: {
      total: 600,
      companyTariff: 90,
      commission: 50,
      totalWithCompanyTariffAndCommission: 740,
    },
    seven: {
      total: 400,
      companyTariff: 60,
      commission: 50,
      totalWithCompanyTariffAndCommission: 510,
    },
  },
});

export const createMockOrder = (overrides: any = {}) => ({
  _id: "test-order-id",
  refId: 12345,
  status: "active",
  portalId: "test-portal-id",
  userId: "test-user-id",
  quoteId: "test-quote-id",
  transportType: "open",
  miles: 1000,
  vehicles: [createMockVehicle()],
  totalPricing: createMockPricingData(),
  schedule: {
    serviceLevel: ServiceLevelOption.OneDay,
    pickupSelected: new Date("2024-01-15T10:00:00Z"),
    deliveryEstimated: [
      new Date("2024-01-16T10:00:00Z"),
      new Date("2024-01-17T10:00:00Z"),
    ],
  },
  customer: {
    name: "Test Customer",
    email: "customer@example.com",
    phone: "555-9999",
  },
  origin: {
    locationType: "residential",
    contact: {
      name: "John Doe",
      email: "john@example.com",
      phone: "555-1234",
    },
    address: {
      address: "123 Main St",
      city: "New York",
      state: "NY",
      zip: "10001",
      longitude: "-74.0060",
      latitude: "40.7128",
    },
  },
  destination: {
    locationType: "residential",
    contact: {
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "555-5678",
    },
    address: {
      address: "456 Oak Ave",
      city: "Los Angeles",
      state: "CA",
      zip: "90210",
      longitude: "-118.2437",
      latitude: "34.0522",
    },
  },
  paymentType: "billing",
  reg: "ABC123",
  tms: {
    guid: "test-guid",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  ...overrides,
});

export const createMockOrderRequest = (overrides: any = {}) => ({
  quoteId: "test-quote-id",
  transportType: "open",
  serviceLevel: ServiceLevelOption.OneDay,
  origin: {
    locationType: "residential",
    contact: {
      name: "John Doe",
      email: "john@example.com",
      phone: "555-1234",
    },
    address: {
      address: "123 Main St",
      city: "New York",
      state: "NY",
      zip: "10001",
      longitude: "-74.0060",
      latitude: "40.7128",
    },
  },
  destination: {
    locationType: "residential",
    contact: {
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "555-5678",
    },
    address: {
      address: "456 Oak Ave",
      city: "Los Angeles",
      state: "CA",
      zip: "90210",
      longitude: "-118.2437",
      latitude: "34.0522",
    },
  },
  vehicles: [createMockVehicle()],
  customer: {
    name: "Test Customer",
    email: "customer@example.com",
    phone: "555-9999",
  },
  schedule: {
    serviceLevel: ServiceLevelOption.OneDay,
    pickupSelected: new Date("2024-01-15T10:00:00Z"),
    deliveryEstimated: [
      new Date("2024-01-16T10:00:00Z"),
      new Date("2024-01-17T10:00:00Z"),
    ],
  },
  reg: "ABC123",
  paymentType: "billing",
  ...overrides,
});
