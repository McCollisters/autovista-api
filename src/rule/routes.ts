import express from "express";
import { createRule } from "./controller";

const router = express.Router();

router.post("/", createRule);

export default router;
