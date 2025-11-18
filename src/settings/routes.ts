import { Router } from "express";
import { getSettings } from "./controllers/getSettings";
import { updateSettings } from "./controllers/updateSettings";
import { getCustomerSettings } from "./controllers/getCustomerSettings";

const router = Router();

router.get("/", getSettings);
router.put("/", updateSettings);
router.get("/customer", getCustomerSettings);

export default router;

