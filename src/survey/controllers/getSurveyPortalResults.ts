import express from "express";
import { Survey, SurveyResponse } from "@/_global/models";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
import { hasPortalAccess, isPlatformRole } from "@/_global/utils/portalRoles";

/**
 * GET /api/v1/survey/portal/:portalId
 * Get portal survey results with averages (legacy format)
 */
export const getSurveyPortalResults = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { portalId } = req.params;
    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));

    const hasPlatformAccess = authUser ? isPlatformRole(authUser.role) : false;
    const canAccessPortal =
      !!authUser && !!portalId && hasPortalAccess(authUser, portalId);

    // Check authorization
    if (!authUser || (!hasPlatformAccess && !canAccessPortal)) {
      return next({
        statusCode: 403,
        message: "You do not have access to this portal's results.",
      });
    }

    // Find all users in this portal
    const surveyQuestions = await Survey.find({}).sort({ order: 1 });

    const getAverageRating = (items: { rating?: number }[]) => {
      if (!items.length) {
        return 0;
      }
      const sum = items.reduce((acc, item) => acc + (item.rating || 0), 0);
      return sum / items.length;
    };

    const questionsPromises = surveyQuestions.map(async (question) => {
      const responses = await SurveyResponse.find({
        question: question._id,
        portal: portalId,
        rating: { $ne: null },
      }).sort({ orderId: -1 });

      return {
        question,
        responses,
        average: getAverageRating(responses),
      };
    });

    const questions = await Promise.all(questionsPromises);

    res.status(200).json(questions);
  } catch (error) {
    next(error);
  }
};
