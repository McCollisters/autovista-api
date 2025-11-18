/**
 * Notification Routes
 *
 * Routes for manual email notifications
 */

import { Router } from "express";
import { sendManualEmail } from "./sendManualEmail";

const router = Router();

/**
 * POST /api/v1/notifications/send
 * Manually trigger an email notification
 *
 * Body:
 * {
 *   emailType: string (e.g., "customerConfirmation", "paymentRequest", "custom")
 *   recipients: Array<{ name?: string, email: string }>
 *   orderId?: string
 *   quoteId?: string
 *   portalId?: string
 *   customSubject?: string
 *   customContent?: { html?: string, text?: string }
 * }
 */
router.post("/send", sendManualEmail);

export default router;
