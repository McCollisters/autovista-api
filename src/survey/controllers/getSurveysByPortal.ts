import express from "express";
import { Survey, SurveyResponse, User } from "@/_global/models";
import { Types } from "mongoose";

/**
 * GET /api/v1/surveys/:portalId
 * Get surveys with responses filtered by portal
 *
 * Note: In the new schema, survey responses are linked to users, not directly to portals.
 * We need to find users in the portal, then get their survey responses.
 */
export const getSurveysByPortal = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { portalId } = req.params;

    // Check authorization
    if (
      req.user?.role !== "MCAdmin" &&
      req.user?.portalId?.toString() !== portalId
    ) {
      return next({
        statusCode: 403,
        message: "You do not have access to this portal's surveys.",
      });
    }

    // Find all users in this portal
    const portalUsers = await User.find({
      portalId: new Types.ObjectId(portalId),
    }).select("_id");

    const userIds = portalUsers.map((user) => user._id);

    if (userIds.length === 0) {
      res.status(200).json([]);
      return;
    }

    // Get all surveys
    const surveys = await Survey.find({}).sort({ createdAt: -1 });

    // Get survey responses for users in this portal
    const surveyResponses = await SurveyResponse.find({
      userId: { $in: userIds },
    })
      .populate("userId", "email firstName lastName")
      .populate("surveyId")
      .lean();

    // Group responses by survey and question
    const results = surveys.map((survey) => {
      const surveyResponsesForSurvey = surveyResponses.filter(
        (response) => response.surveyId?.toString() === survey._id.toString(),
      );

      // Group by question
      const questionResults = survey.questions.map((question) => {
        const questionResponses = surveyResponsesForSurvey
          .flatMap((response) =>
            response.responses
              .filter(
                (r) => r.questionId?.toString() === question._id?.toString(),
              )
              .map((r) => ({
                ...response,
                answer: r.answer,
              })),
          )
          .filter((r) => {
            // Only include rating questions with numeric answers
            if (question.type === "rating") {
              return typeof r.answer === "number";
            }
            return true;
          });

        // Calculate average for rating questions
        let average = null;
        if (question.type === "rating" && questionResponses.length > 0) {
          const ratings = questionResponses
            .map((r) => r.answer)
            .filter((a): a is number => typeof a === "number");
          if (ratings.length > 0) {
            average =
              ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
          }
        }

        return {
          question: {
            _id: question._id,
            questionText: question.questionText,
            type: question.type,
          },
          responses: questionResponses,
          average,
        };
      });

      return {
        survey: {
          _id: survey._id,
          description: survey.description,
          status: survey.status,
          questions: survey.questions,
        },
        questionResults,
      };
    });

    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};
