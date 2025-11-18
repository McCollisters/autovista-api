/**
 * Sign S3 Upload Controller
 *
 * Generates a signed URL for direct S3 file uploads
 */

import express from "express";
import { logger } from "@/core/logger";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const signS3 = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { fileName, fileType } = req.body;

    if (!fileName) {
      return next({
        statusCode: 400,
        message: "fileName is required.",
      });
    }

    if (!fileType) {
      return next({
        statusCode: 400,
        message: "fileType is required.",
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

    // Create PutObject command
    const command = new PutObjectCommand({
      Bucket: s3Bucket,
      Key: fileName,
      ContentType: fileType,
      ACL: "public-read",
    });

    // Generate signed URL (expires in 500 seconds)
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 500 });

    const returnData = {
      signedRequest: signedUrl,
      url: `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/${fileName}`,
    };

    logger.info("S3 signed URL generated", {
      fileName,
      fileType,
    });

    res.status(200).json({
      success: true,
      data: returnData,
    });
  } catch (error) {
    logger.error("Error generating S3 signed URL", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return next({
      statusCode: 500,
      message: "Error generating signed URL.",
    });
  }
};
