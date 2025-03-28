import express from "express";
import { createOrder } from "./controller";

const router = express.Router();

router.post("/", createOrder);

export default router;
