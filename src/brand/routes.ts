import express from "express";
import { createBrand, deleteBrand, updateBrand } from "./controller";

const router = express.Router();

router.post("/", createBrand);
router.put("/:brandId", updateBrand);
router.delete("/:brandId", deleteBrand);

export default router;
