import { Router } from "express";
import { 
  createPortal,
  getPortal,
  updatePortal
} from "./controller";

const router = Router(); 

router.post("/", createPortal);
router.get("/:portalId", getPortal); 
router.put("/:portalId", updatePortal); 

export default router; 
