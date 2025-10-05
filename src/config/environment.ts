// Initialize dotenv at the very top of the config module
import dotenv from "dotenv";
dotenv.config();

export interface DatabaseConfig {
  uri: string;
  options: {
    maxPoolSize: number;
    serverSelectionTimeoutMS: number;
    ssl?: boolean;
    sslValidate?: boolean;
  };
}

export interface AWSConfig {
  region: string;
  sqs: {
    queueUrl: string;
  };
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: DatabaseConfig;
  aws: AWSConfig;
  allowedOrigins: string[];
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
      sslValidate: true,
    };
  }

  return baseConfig;
};

export const config: AppConfig = {
  port: parseInt(process.env.PORT || "8080", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  database: {
    uri: process.env.MONGODB_DEV_URI as string,
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
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [
    "http://localhost:3000",
  ],
} as const;

// Validate required environment variables
const requiredEnvVars = ["MONGODB_DEV_URI"];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.join(", ")}`,
  );
}
