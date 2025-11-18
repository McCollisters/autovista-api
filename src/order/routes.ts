import { Router } from "express";
import { createOrder } from "./controllers/createOrder";
import { getOrder } from "./controllers/getOrder";
import { getOrders } from "./controllers/getOrders";
import { updateOrder } from "./controllers/updateOrder";
import { deleteOrder } from "./controllers/deleteOrder";
import { requestTrackOrder } from "./controllers/requestTrackOrder";
import { getCommissionReports } from "./controllers/getCommissionReports";
import { exportOrders } from "./controllers/exportOrders";
import { getOrdersAnalytics } from "./controllers/getOrdersAnalytics";
import { addOrderFiles } from "./controllers/addOrderFiles";
import { removeOrderFile } from "./controllers/removeOrderFile";

const router = Router();

// Specific routes first (before parameterized routes)
router.post("/export", exportOrders);
router.get("/analytics", getOrdersAnalytics);
router.post("/reports/commission", getCommissionReports);

// General routes
router.get("/", getOrders);
router.post("/", createOrder);

// Parameterized routes
router.get("/:orderId", getOrder);
router.patch("/:orderId", updateOrder);
router.delete("/:orderId", deleteOrder);
router.post("/:orderId/track", requestTrackOrder);
router.put("/:orderId/files", addOrderFiles);
router.put("/mcadmin/:orderId/file", removeOrderFile);

export default router;
