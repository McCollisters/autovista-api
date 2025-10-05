import { Router } from "express";
import {
  createModifierSet,
  getModifierSet,
  updateModifierSet,
  deleteModifierSet,
  getModifierSets,
} from "./controller";

const router = Router();

router.get("/", getModifierSets);
router.post("/", createModifierSet);
router.get("/:modifierId", getModifierSet);
router.put("/:modifierId", updateModifierSet);
router.delete("/:modifierId", deleteModifierSet);

export default router;
