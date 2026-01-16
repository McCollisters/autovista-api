import express from "express";
import { Survey, SurveyResponse, Portal } from "@/_global/models";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
import { hasPortalAccess, isPlatformRole } from "@/_global/utils/portalRoles";

/**
 * GET /api/v1/surveys/ratings/:portalId
 * Get rating question averages (overall + per portal)
 */
export const getSurveyRatingSummary = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { portalId } = req.params;
    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));
    const normalizedPortal = portalId?.toLowerCase();
    const isAllPortals = normalizedPortal === "all";

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
        message: "You do not have access to these survey results.",
      });
    }

    const ratingQuestions = await Survey.find({ isScale: true }).sort({
      order: 1,
    });

    if (ratingQuestions.length === 0) {
      res.status(200).json([]);
      return;
    }

    let portals = [];
    if (isAllPortals) {
      portals = await Portal.find({}).select("_id companyName");
    } else {
      const portal = await Portal.findById(portalId).select("_id companyName");
      if (!portal) {
        return next({
          statusCode: 404,
          message: "Portal not found.",
        });
      }
      portals = [portal];
    }

    const portalIndex = new Map(
      portals.map((portal) => [portal._id.toString(), portal.companyName]),
    );

    const getAverage = (items: { rating?: number }[]) => {
      if (!items.length) {
        return null;
      }
      const sum = items.reduce((acc, item) => acc + (item.rating || 0), 0);
      return sum / items.length;
    };

    const results = [];

    for (const question of ratingQuestions) {
      const overallResponses = await SurveyResponse.find({
        question: question._id,
        rating: { $ne: null },
      });

      if (isAllPortals) {
        const portalsResults = [];
        for (const portal of portals) {
          const portalResponses = await SurveyResponse.find({
            question: question._id,
            portal: portal._id,
            rating: { $ne: null },
          });

          const portalAverage = getAverage(portalResponses);
          if (portalAverage !== null) {
            portalsResults.push({
              portalId: portal._id.toString(),
              companyName:
                portalIndex.get(portal._id.toString()) || "Unknown Portal",
              average: portalAverage,
              count: portalResponses.length,
            });
          }
        }

        results.push({
          question: {
            _id: question._id,
            questionText: question.question,
            type: "rating",
          },
          overall: {
            average: getAverage(overallResponses),
            count: overallResponses.length,
          },
          portals: portalsResults,
        });
        continue;
      }

      const portalResponses = await SurveyResponse.find({
        question: question._id,
        portal: portalId,
        rating: { $ne: null },
      });

      results.push({
        question: {
          _id: question._id,
          questionText: question.question,
          type: "rating",
        },
        portal: {
          portalId,
          companyName: portalIndex.get(portalId) || "Unknown Portal",
          average: getAverage(portalResponses),
          count: portalResponses.length,
        },
      });
    }

    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};
