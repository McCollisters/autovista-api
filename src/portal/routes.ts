import { Router } from "express";
import { createPortal } from "./controllers/createPortal";
import { getPortal } from "./controllers/getPortal";
import { updatePortal } from "./controllers/updatePortal";

import { deletePortal } from "./controllers/deletePortal";
const router = Router();

router.post("/", createPortal);
router.get("/:portalId", getPortal);
router.patch("/:portalId", updatePortal);
router.delete("/:portalId", deletePortal);

export default router;
