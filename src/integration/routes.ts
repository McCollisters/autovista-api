/**
 * Integration Routes
 *
 * Routes for third-party integrations (S3, Captivated, etc.)
 */

import { Router } from "express";
import { signS3 } from "./controllers/signS3";
import { getFile } from "./controllers/getFile";
import { captivatedCallback } from "./controllers/captivatedCallback";

const router = Router();

// S3 file operations
router.post("/sign_s3", signS3);
router.get("/get_file/:fileKey", getFile);

// Captivated SMS location tracking callback
router.post("/captivated/callback", captivatedCallback);

// Export individual route handlers for legacy path mounting
export { signS3, getFile, captivatedCallback };
export default router;
