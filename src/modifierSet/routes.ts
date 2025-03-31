import { Router } from "express";
import { 
  createRule,
  getRule,
  updateRule,
  deleteRule, 
  getRules
} from "./controller";

const router = Router(); 

router.get("/", getRules); 
router.post("/", createRule);
router.get("/:ruleId", getRule); 
router.put("/:ruleId", updateRule); 
router.delete("/:ruleId",deleteRule); 

export default router; 
