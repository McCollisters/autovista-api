import { Router } from "express";
import { 
  createPortal,
  getPortal,
  updatePortal,
  deletePortal
} from "./controller";

const router = Router(); 

router.post("/", createPortal);
router.get("/:portalId", getPortal); 
router.put("/:portalId", updatePortal); 
router.delete("/:portalId",deletePortal); 

export default router; 
