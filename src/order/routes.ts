import { Router } from "express";
import { createOrder } from "./controllers/createOrder";
import { getOrder } from "./controllers/getOrder";
import { getOrders } from "./controllers/getOrders";
import { updateOrder } from "./controllers/updateOrder";
import { deleteOrder } from "./controllers/deleteOrder";

const router = Router();

router.get("/", getOrders);
router.post("/", createOrder);
router.get("/:orderId", getOrder);
router.patch("/:orderId", updateOrder);
router.delete("/:orderId", deleteOrder);

export default router;
