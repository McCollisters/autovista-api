import express from "express";
import { Role } from "@/user/schema";

export const DEMO_MODE_HEADER = "x-demo-mode";

export const DEMO_MODE_DISABLED_MESSAGE =
  "Disabled in Demo Mode. Turn off Demo Mode to make changes.";

export function isDemoModeRequest(req: express.Request): boolean {
  return Boolean((req as any).demoMode);
}

/**
 * If Demo Mode is active, send payload and return true (caller should return).
 */
export function respondIfDemo(
  req: express.Request,
  res: express.Response,
  payload: unknown,
  statusCode = 200,
): boolean {
  if (!isDemoModeRequest(req)) {
    return false;
  }
  res.status(statusCode).json(payload);
  return true;
}

/**
 * Block mutating operations while Demo Mode is on.
 * Returns true if the request was rejected (caller should return).
 */
export function rejectDemoMutation(
  req: express.Request,
  next: express.NextFunction,
): boolean {
  if (!isDemoModeRequest(req)) {
    return false;
  }
  next({
    statusCode: 403,
    message: DEMO_MODE_DISABLED_MESSAGE,
  });
  return true;
}

export function isPlatformAdminRole(role?: string): boolean {
  return role === Role.PlatformAdmin;
}
