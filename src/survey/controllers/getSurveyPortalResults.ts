import express from "express";
import { Survey, SurveyResponse, User } from "@/_global/models";
import { Types } from "mongoose";

/**
 * GET /api/v1/survey/portal/:portalId
 * Get portal survey results with averages
 *
 * Returns survey questions with responses and averages for a specific portal.
 */
export const getSurveyPortalResults = async (
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
        message: "You do not have access to this portal's results.",
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

    // Get the survey (assuming there's one main survey)
    const survey = await Survey.findOne({}).sort({ createdAt: -1 });

    if (!survey) {
      res.status(200).json([]);
      return;
    }

    // Get survey responses for users in this portal
    const surveyResponses = await SurveyResponse.find({
      userId: { $in: userIds },
      surveyId: survey._id,
    })
      .populate("userId", "email firstName lastName")
      .lean();

    // Process each question
    const questions = await Promise.all(
      survey.questions.map(async (question) => {
        // Get responses for this question
        const questionResponses = surveyResponses
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
          })
          .sort((a, b) => {
            // Sort by createdAt descending (most recent first)
            const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bDate - aDate;
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
      }),
    );

    res.status(200).json(questions);
  } catch (error) {
    next(error);
  }
};
