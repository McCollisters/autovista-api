import express from "express";
import { createSurvey } from "./controller";
import { getSurveysByPortal } from "./controllers/getSurveysByPortal";
import { getSurveyPortalResults } from "./controllers/getSurveyPortalResults";
import { getSurveyRatingSummary } from "./controllers/getSurveyRatingSummary";
import { getSurveyOrderResults } from "./controllers/getSurveyOrderResults";
import { exportSurveys } from "./controllers/exportSurveys";

const router = express.Router();

// Public route (for survey submission)
router.post("/", createSurvey);

// Protected routes (require authentication)
// Specific routes first (before parameterized routes)
router.get("/export/:portalId", exportSurveys);
router.get("/portal/:portalId", getSurveyPortalResults);
router.get("/ratings/:portalId", getSurveyRatingSummary);
router.get("/order/:orderId", getSurveyOrderResults);

// General routes (legacy format)
router.get("/", getSurveysByPortal);
router.get("/:portalId", getSurveysByPortal);

export default router;
