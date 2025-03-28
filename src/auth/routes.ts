import express from "express";
import { createBrand } from "./controller";

const router = express.Router();

router.post("/", createBrand);

export default router;
