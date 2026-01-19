import { Router } from "express";
import { createOrder } from "./controllers/createOrder";
import { getOrder } from "./controllers/getOrder";
import { updateOrder } from "./controllers/updateOrder";
import { deleteOrder } from "./controllers/deleteOrder";
import { requestTrackOrder } from "./controllers/requestTrackOrder";
import { getCommissionReports } from "./controllers/getCommissionReports";
import { exportOrders } from "./controllers/exportOrders";
import { getOrdersAnalytics } from "./controllers/getOrdersAnalytics";
import { getOrderActivities } from "./controllers/getOrderActivities";
import { acceptOrderTerms } from "./controllers/acceptOrderTerms";
import { getOrderStatus } from "./controllers/getOrderStatus";
import { requestDriverLocation } from "./controllers/requestDriverLocation";
import { createOrderCustomer } from "./controllers/createOrderCustomer";
import { sendOrderToTms } from "./controllers/sendOrderToTms";

const router = Router();

// Specific routes first (before parameterized routes)
router.post("/export", exportOrders);
router.get("/analytics", getOrdersAnalytics);
router.post("/reports/commission", getCommissionReports);
router.post("/terms", acceptOrderTerms);
router.post("/customer", createOrderCustomer);

// General routes
router.post("/", createOrder);

// Parameterized routes
router.get("/:orderId", getOrder);
router.get("/:orderId/activities", getOrderActivities);
router.post("/:orderId/tms/send", sendOrderToTms);
router.patch("/:orderId", updateOrder);
router.delete("/:orderId", deleteOrder);
router.post("/:orderId/track", requestTrackOrder);
router.post("/:orderId/status", getOrderStatus);
router.post("/:orderId/location", requestDriverLocation);

export default router;
