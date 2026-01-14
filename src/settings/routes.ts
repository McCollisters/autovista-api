import { Router } from "express";
import { getSettings } from "./controllers/getSettings";
import { updateSettings } from "./controllers/updateSettings";
import { getCustomerSettings } from "./controllers/getCustomerSettings";
import { getGlobalModifierSets } from "./controllers/getGlobalModifierSets";

const router = Router();

router.get("/", getSettings);
router.put("/", updateSettings);
router.get("/customer", getCustomerSettings);
router.get("/global-modifier-sets", getGlobalModifierSets);

export default router;

