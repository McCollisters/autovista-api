import express from "express";
import { createSurvey } from "./controller";
import { getSurveys } from "./controllers/getSurveys";
import { getSurveysByPortal } from "./controllers/getSurveysByPortal";
import { getSurveyPortalResults } from "./controllers/getSurveyPortalResults";
import { exportSurveys } from "./controllers/exportSurveys";

const router = express.Router();

// Public route (for survey submission)
router.post("/", createSurvey);

// Protected routes (require authentication)
// Specific routes first (before parameterized routes)
router.get("/export/:portalId", exportSurveys);
router.get("/portal/:portalId", getSurveyPortalResults);

// General routes
router.get("/", getSurveys);
router.get("/:portalId", getSurveysByPortal);

export default router;
