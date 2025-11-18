import express from "express";
import { verifyEmail2FA } from "./controllers/verifyEmail2FA";
import { loginEmail2FA } from "./controllers/loginEmail2FA";
import { authenticateApiUser } from "./controllers/authenticateApiUser";
import { loginSocial } from "./controllers/loginSocial";

const router = express.Router();

// Public authentication endpoints
router.get("/public/auth", authenticateApiUser);

// 2FA Authentication endpoints
router.post("/verify-email-2fa", verifyEmail2FA);
router.post("/login-email-2fa", loginEmail2FA);

// Social login
router.post("/login-social", loginSocial);

export default router;
