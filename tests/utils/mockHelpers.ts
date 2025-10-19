import { jest } from "@jest/globals";

// Mock Mongoose models
export const mockMongooseModel = () => {
  const mockDocument = {
    // @ts-ignore
    save: jest.fn().mockResolvedValue({}),
    toObject: jest.fn().mockReturnValue({}),
    lean: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    find: jest.fn().mockReturnThis(),
    // @ts-ignore
    create: jest.fn().mockResolvedValue({}),
    findById: jest.fn().mockReturnThis(),
    findByIdAndUpdate: jest.fn().mockReturnThis(),
    findByIdAndDelete: jest.fn().mockReturnThis(),
    deleteOne: jest.fn().mockReturnThis(),
    deleteMany: jest.fn().mockReturnThis(),
    countDocuments: jest.fn().mockReturnThis(),
    aggregate: jest.fn().mockReturnThis(),
    // @ts-ignore
    exec: jest.fn().mockResolvedValue({}),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    equals: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    nin: jest.fn().mockReturnThis(),
    exists: jest.fn().mockReturnThis(),
    ne: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    regex: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    nor: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    elemMatch: jest.fn().mockReturnThis(),
    size: jest.fn().mockReturnThis(),
    all: jest.fn().mockReturnThis(),
    bitsAllSet: jest.fn().mockReturnThis(),
    bitsAnySet: jest.fn().mockReturnThis(),
    bitsAllClear: jest.fn().mockReturnThis(),
    bitsAnyClear: jest.fn().mockReturnThis(),
  };

  return jest.fn(() => mockDocument);
};

// Mock Express request/response objects
export const mockRequest = (overrides: any = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: null,
  ...overrides,
});

export const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  res.get = jest.fn().mockReturnValue(res);
  res.locals = {};
  return res;
};

// Mock next function
export const mockNext = () => jest.fn();

// Helper to create mock data with specific overrides
export const createMockWithOverrides = <T>(
  baseData: T,
  overrides: Partial<T> = {},
): T => {
  return { ...baseData, ...overrides };
};

// Helper to mock async functions
export const mockAsyncFunction = <T>(returnValue: T, shouldReject = false) => {
  return jest.fn().mockImplementation(() => {
    return shouldReject
      ? Promise.reject(returnValue)
      : Promise.resolve(returnValue);
  });
};

// Helper to create mock error
export const createMockError = (message: string, statusCode = 500) => {
  const error = new Error(message) as any;
  error.statusCode = statusCode;
  return error;
};

// Helper to wait for async operations
export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
