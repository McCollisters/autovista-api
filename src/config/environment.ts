export interface DatabaseConfig {
  uri: string;
  options: {
    maxPoolSize: number;
    serverSelectionTimeoutMS: number;
    ssl?: boolean;
  };
}

export interface AWSConfig {
  region: string;
  sqs: {
    queueUrl: string;
  };
}

export interface NotificationConfig {
  email: {
    provider: "sendgrid";
    enabled: boolean;
    fromAddress?: string;
    fromName?: string;
    replyTo?: string;
  };
  sms: {
    provider: "aws-sns" | "twilio";
    enabled: boolean;
    fromNumber?: string;
  };
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: DatabaseConfig;
  aws: AWSConfig;
  allowedOrigins: string[];
  notifications?: NotificationConfig;
}

const getDatabaseConfig = (): DatabaseConfig["options"] => {
  const baseConfig = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  };

  if (process.env.NODE_ENV === "production") {
    return {
      ...baseConfig,
      ssl: true,
    };
  }

  return baseConfig;
};

// Get MongoDB URI based on environment
const getMongoDbUri = (): string => {
  const nodeEnv = process.env.NODE_ENV || "development";
  
  // In production, prefer MONGODB_PROD_URI, fallback to MONGODB_DEV_URI
  if (nodeEnv === "production") {
    return (process.env.MONGODB_PROD_URI || process.env.MONGODB_DEV_URI) as string;
  }
  
  // In development/test, use MONGODB_DEV_URI
  return process.env.MONGODB_DEV_URI as string;
};

const normalizeOrigin = (value: string) => value.trim().replace(/\/$/, "");

export const config: AppConfig = {
  port: parseInt(process.env.PORT || "8080", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  database: {
    uri: getMongoDbUri(),
    options: getDatabaseConfig(),
  },
  aws: {
    region: process.env.AWS_REGION || "us-east-1",
    sqs: {
      queueUrl:
        process.env.SQS_QUEUE_URL ||
        "https://sqs.us-east-1.amazonaws.com/016551391727/notifications-immediate.fifo",
    },
  },
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
        .map(normalizeOrigin)
        .filter(Boolean)
    : ["http://localhost:3000"],
} as const;

// Test-specific environment variables
export const testConfig = {
  testDbUri: process.env.MONGODB_TEST_URI,
  mapboxApiKey: process.env.MAPBOX_API_KEY,
  superDispatchApiKey: process.env.SD_PRICING_API_KEY,
} as const;

// Validate required environment variables
const nodeEnv = process.env.NODE_ENV || "development";
const requiredEnvVars: string[] = [];

if (nodeEnv === "production") {
  // In production, require either MONGODB_PROD_URI or MONGODB_DEV_URI
  if (!process.env.MONGODB_PROD_URI && !process.env.MONGODB_DEV_URI) {
    requiredEnvVars.push("MONGODB_PROD_URI or MONGODB_DEV_URI");
  }
} else {
  // In development, require MONGODB_DEV_URI
  requiredEnvVars.push("MONGODB_DEV_URI");
}

const missingVars = requiredEnvVars.filter((varName) => {
  if (varName === "MONGODB_PROD_URI or MONGODB_DEV_URI") {
    return !process.env.MONGODB_PROD_URI && !process.env.MONGODB_DEV_URI;
  }
  return !process.env[varName];
});

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.join(", ")}`,
  );
}
