import express from "express";
import { ObjectsToCsv } from "objects-to-csv";
import fs from "fs";
import path from "path";
import { Survey, SurveyResponse, User, Order } from "@/_global/models";
import { Types } from "mongoose";
import { logger } from "@/core/logger";

/**
 * GET /api/v1/surveys/export/:portalId
 * Export surveys to CSV for a specific portal
 *
 * Note: This is a simplified export. The old implementation had hardcoded question IDs.
 * This version works with the new schema structure.
 */
export const exportSurveys = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { portalId } = req.params;

    // Find all users in this portal
    const portalUsers = await User.find({
      portalId: new Types.ObjectId(portalId),
    }).select("_id email");

    const userIds = portalUsers.map((user) => user._id);
    const userMap = new Map(
      portalUsers.map((user) => [user._id.toString(), user.email]),
    );

    if (userIds.length === 0) {
      return next({
        statusCode: 404,
        message: "No users found for this portal.",
      });
    }

    // Get the survey
    const survey = await Survey.findOne({}).sort({ createdAt: -1 });

    if (!survey) {
      return next({
        statusCode: 404,
        message: "No survey found.",
      });
    }

    // Get survey responses for users in this portal
    const surveyResponses = await SurveyResponse.find({
      userId: { $in: userIds },
      surveyId: survey._id,
    }).lean();

    // Group responses by user
    const groupedByUser = new Map<string, any>();

    surveyResponses.forEach((response) => {
      const userId = response.userId.toString();
      if (!groupedByUser.has(userId)) {
        groupedByUser.set(userId, {
          userId,
          email: userMap.get(userId) || "Unknown",
          responses: {},
        });
      }

      const userData = groupedByUser.get(userId)!;
      response.responses.forEach((r) => {
        const questionId = r.questionId.toString();
        userData.responses[questionId] = {
          answer: r.answer,
          questionId,
        };
      });
    });

    // Format for CSV
    const formattedResponses = Array.from(groupedByUser.values()).map(
      (userData) => {
        const row: any = {
          email: userData.email,
          userId: userData.userId,
        };

        // Add each question as a column
        survey.questions.forEach((question, index) => {
          const questionId = question._id.toString();
          const response = userData.responses[questionId];
          row[`q${index + 1}_${question.type}`] = response?.answer || null;
        });

        return row;
      },
    );

    // Calculate averages
    const averages: any = {
      email: "Average",
      userId: null,
    };

    survey.questions.forEach((question, index) => {
      if (question.type === "rating") {
        const ratings = formattedResponses
          .map((r) => r[`q${index + 1}_${question.type}`])
          .filter((a): a is number => typeof a === "number" && a !== null);
        if (ratings.length > 0) {
          averages[`q${index + 1}_${question.type}`] = (
            ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
          ).toFixed(2);
        } else {
          averages[`q${index + 1}_${question.type}`] = "N/A";
        }
      } else {
        averages[`q${index + 1}_${question.type}`] = null;
      }
    });

    // Add header row with question text
    const headerRow: any = {
      email: "Question",
      userId: null,
    };
    survey.questions.forEach((question, index) => {
      headerRow[`q${index + 1}_${question.type}`] = question.questionText;
    });

    // Combine: header, averages, then responses
    const csvData = [headerRow, averages, ...formattedResponses];

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
