import { Router } from "express";
import { 
  createOrder,
  getOrder,
  updateOrder,
  deleteOrder, 
  getOrders
} from "./controller";

const router = Router(); 

router.get("/", getOrders); 
router.post("/", createOrder);
router.get("/:orderId", getOrder); 
router.put("/:orderId", updateOrder); 
router.delete("/:orderId",deleteOrder); 

export default router; 
