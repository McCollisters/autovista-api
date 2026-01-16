import express from "express";
import { Portal, Survey, SurveyResponse } from "@/_global/models";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
import { hasPortalAccess, isPlatformRole } from "@/_global/utils/portalRoles";

/**
 * GET /api/v1/surveys/:portalId
 * Get survey results grouped by question (legacy format)
 */
export const getSurveysByPortal = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { portalId } = req.params;
    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));
    const normalizedPortalId = portalId?.toLowerCase();
    const isAllPortals = !portalId || normalizedPortalId === "all";

    // Check authorization
    const hasPlatformAccess = authUser ? isPlatformRole(authUser.role) : false;
    const canAccessPortal =
      !!authUser && !!portalId && hasPortalAccess(authUser, portalId);

    if (
      !authUser ||
      (isAllPortals && authUser.role !== "platform_admin") ||
      (!isAllPortals && !hasPlatformAccess && !canAccessPortal)
    ) {
      return next({
        statusCode: 403,
        message: "You do not have access to this portal's surveys.",
      });
    }

    const questions = await Survey.find({}).sort({ order: 1 });

    const portals = isAllPortals
      ? await Portal.find({})
      : await Portal.find({ _id: portalId });

    const getAverageRating = (items: { rating?: number }[]) => {
      if (!items.length) {
        return 0;
      }
      const sum = items.reduce((acc, item) => acc + (item.rating || 0), 0);
      return sum / items.length;
    };

    const groupQuestionResponsesByPortal = async (question: any) => {
      const responses = [];

      const allResults = await SurveyResponse.find({
        question,
        rating: { $ne: null },
      }).sort({ orderId: -1 });

      const average = getAverageRating(allResults);

      let averagePortal;
      if (!isAllPortals && portalId) {
        const portalResults = await SurveyResponse.find({
          question,
          portal: portalId,
          rating: { $ne: null },
        }).sort({ orderId: -1 });

        averagePortal = getAverageRating(portalResults);
      }

      for (const portal of portals) {
        const portalResults = await SurveyResponse.find({
          portal,
          question,
        }).sort({ orderId: -1 });

        if (portalResults.length > 0) {
          responses.push({
            portalResults,
            portal: portal._id,
            average: getAverageRating(portalResults),
            averagePortal,
            companyName: portal.companyName,
          });
        }
      }

      return {
        question,
        responses,
        average,
      };
    };

    const results = [];
    for (const question of questions) {
      results.push(await groupQuestionResponsesByPortal(question));
    }

    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};
