import { Router } from "express";
import { getEmailTemplates } from "./controllers/getEmailTemplates";
import { getEmailTemplate } from "./controllers/getEmailTemplate";
import { updateEmailTemplate } from "./controllers/updateEmailTemplate";

const router = Router();

router.get("/", getEmailTemplates);
router.get("/:templateId", getEmailTemplate);
router.put("/:templateId", updateEmailTemplate);

export default router;

