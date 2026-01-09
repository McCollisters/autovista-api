import { Router } from "express";
import { createPortal } from "./controllers/createPortal";
import { getPortal } from "./controllers/getPortal";
import { updatePortal } from "./controllers/updatePortal";

import { deletePortal } from "./controllers/deletePortal";
const router = Router();

router.post("/", createPortal);
router.get("/:quoteId", getPortal);
router.patch("/:quoteId", updatePortal);
router.delete("/:quoteId", deletePortal);

export default router;
