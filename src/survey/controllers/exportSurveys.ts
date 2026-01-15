import express from "express";
import ObjectsToCsv from "objects-to-csv";
import fs from "fs";
import path from "path";
import { SurveyResponse } from "@/_global/models";
import { logger } from "@/core/logger";

/**
 * GET /api/v1/surveys/export/:portalId
 * Export surveys to CSV for a specific portal
 *
 * Note: This exports legacy survey responses in a flat format.
 */
export const exportSurveys = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { portalId } = req.params;

    const normalizedPortal = portalId?.toLowerCase();
    const isAllPortals = normalizedPortal === "all";

    const surveyResponses = await SurveyResponse.find(
      isAllPortals ? {} : { portal: portalId },
    )
      .populate("question")
      .populate("portal")
      .lean();

    const csvData = surveyResponses.map((response) => {
      const portalName =
        response.portalName ||
        (response.portal as any)?.companyName ||
        "Unknown";
      const portalValue =
        (response.portal as any)?._id?.toString?.() ||
        response.portal?.toString?.() ||
        null;

      const questionText =
        (response.question as any)?.question ||
        (response.question as any)?.questionText ||
        "";

      return {
        portalId: portalValue,
        portalName,
        email: response.email || "",
        orderId: response.orderId || null,
        orderDelivery: response.orderDelivery || "",
        question: questionText,
        rating: response.rating ?? null,
        explanation: response.explanation || "",
        createdAt: response.createdAt || null,
      };
    });

    // Generate CSV
    const csv = new ObjectsToCsv(csvData);
    const tempFilePath = path.join(
      process.cwd(),
      `survey-export-${portalId}-${Date.now()}.csv`,
    );

    await csv.toDisk(tempFilePath);

    // Send file and clean up
    res.download(tempFilePath, `survey-export-${portalId}.csv`, (err) => {
      if (err) {
        logger.error("Error downloading survey export:", err);
      }
      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });
  } catch (error) {
    next(error);
  }
};
