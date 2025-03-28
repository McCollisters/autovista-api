import express from "express";
import { createSurvey } from "./controller";

const router = express.Router();

router.post("/", createSurvey);

export default router;
