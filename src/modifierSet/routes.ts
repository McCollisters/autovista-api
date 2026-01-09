import { Router } from "express";
import {
  createModifierSet,
  getModifierSet,
  updateModifierSet,
  deleteModifierSet,
} from "./controller";

const router = Router();

router.post("/", createModifierSet);
router.get("/:ruleId", getModifierSet);
router.put("/:ruleId", updateModifierSet);
router.delete("/:ruleId", deleteModifierSet);

export default router;
