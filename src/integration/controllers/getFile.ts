/**
 * Get File from S3 Controller
 *
 * Retrieves and streams a file from S3
 */

import express from "express";
import { logger } from "@/core/logger";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

export const getFile = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const fileKey = req.params.fileKey;

    if (!fileKey) {
      return next({
        statusCode: 400,
        message: "fileKey is required.",
      });
    }

    const awsAccessKeyId =
      process.env.AWSAccessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const awsSecretKey =
      process.env.AWSSecretKey || process.env.AWS_SECRET_ACCESS_KEY;
    const awsRegion = process.env.AWS_REGION || "us-east-1";
    const s3Bucket = process.env.Bucket || process.env.S3_BUCKET;

    if (!awsAccessKeyId || !awsSecretKey) {
      logger.error("AWS credentials not configured");
      return next({
        statusCode: 500,
        message: "AWS S3 is not configured.",
      });
    }

    if (!s3Bucket) {
      logger.error("S3 bucket not configured");
      return next({
        statusCode: 500,
        message: "S3 bucket is not configured.",
      });
    }

    // Create S3 client
    const s3Client = new S3Client({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretKey,
      },
    });

    // Create GetObject command
    const command = new GetObjectCommand({
      Bucket: s3Bucket,
      Key: fileKey,
    });

    try {
      // Get object from S3
      const response = await s3Client.send(command);

      if (!response.Body) {
        return next({
          statusCode: 404,
          message: "File not found.",
        });
      }

      // Set response headers
      res.setHeader(
        "Content-Type",
        response.ContentType || "application/octet-stream",
      );
      res.setHeader("Content-Disposition", `attachment; filename=${fileKey}`);

      // Stream the file to response
      // AWS SDK v3 returns Body as a Readable stream
      if (response.Body) {
        // Convert the stream to Node.js readable stream if needed
        const stream = response.Body as any;
        if (typeof stream.pipe === "function") {
          stream.pipe(res);
        } else {
          // If it's an async iterable, convert to buffer
          const chunks: Uint8Array[] = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          res.send(buffer);
        }
      } else {
        return next({
          statusCode: 404,
          message: "File not found.",
        });
      }

      logger.info("File retrieved from S3", {
        fileKey,
      });
    } catch (error: any) {
      if (
        error.name === "NoSuchKey" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        logger.warn("File not found in S3", { fileKey });
        return next({
          statusCode: 404,
          message: "File not found.",
        });
      }

      throw error;
    }
  } catch (error) {
    logger.error("Error retrieving file from S3", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      fileKey: req.params.fileKey,
    });
    return next({
      statusCode: 500,
      message: "Error retrieving file.",
    });
  }
};
