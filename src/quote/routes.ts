import express from "express";
import { createQuote } from "./controller";

const router = express.Router();

router.post("/", createQuote);

export default router;
