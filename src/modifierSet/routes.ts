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
router.get("/:ruleId", getModifierSet);
router.put("/:ruleId", updateModifierSet);
router.delete("/:ruleId", deleteModifierSet);

export default router;
