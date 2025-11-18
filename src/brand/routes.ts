import express from "express";
import { createBrand } from "./controller";
import { getMakes } from "./controllers/getMakes";

const router = express.Router();

router.get("/", getMakes);
router.post("/", createBrand);

export default router;
