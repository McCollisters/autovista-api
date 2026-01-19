import express from "express";
import { User, Portal } from "@/_global/models";
import { Role } from "../schema";
import { Status } from "../../_global/enums";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
import { resolveId } from "@/_global/utils/resolveId";

export const createUserAdmin = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));

    if (!authUser) {
      return next({
        statusCode: 401,
        message: "Unauthorized",
      });
    }

    // Only MCAdmin or Admin can create users
    if (authUser.role !== "MCAdmin" && authUser.role !== "Admin") {
      return next({
        statusCode: 403,
        message: "Forbidden: Admin access required",
      });
    }

    const {
      email,
      firstName,
      lastName,
      role,
      portalId,
      phone,
      mobilePhone,
      password,
      portalRoles,
    } = req.body;

    logger.info(`New user ${email} created by ${authUser.email}`);

    if (!email) {
      return next({
        statusCode: 400,
        message: "Email is required.",
      });
    }

    if (!portalId) {
      return next({
        statusCode: 400,
        message: "Please select a portal for this user.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return next({
        statusCode: 409,
        message: "A user with this email already exists.",
      });
    }

    const resolvedPortalId = resolveId(portalId);

    // Verify portal exists
    const portal = await Portal.findById(resolvedPortalId);

    if (!portal) {
      return next({
        statusCode: 404,
        message: "Portal not found.",
      });
    }

    // Create user data
    const resolvedRole = role || Role.PortalUser;

    const userData: any = {
      email: normalizedEmail,
      firstName,
      lastName,
      role: resolvedRole,
      portalId: resolvedPortalId,
      status: Status.Active,
      fullName: `${firstName} ${lastName}`,
    };

    if (portalRoles) {
      userData.portalRoles = portalRoles.map((entry: any) => ({
        portalId: resolveId(entry?.portalId),
        role: entry?.role,
      }));
    } else if (
      resolvedPortalId &&
      (resolvedRole === Role.PortalAdmin || resolvedRole === Role.PortalUser)
    ) {
      userData.portalRoles = [{ portalId: resolvedPortalId, role: resolvedRole }];
    }

    if (password) {
      userData.password = password;
    }

    if (phone) {
      userData.phone = phone === "empty" ? null : phone;
    }

    if (mobilePhone) {
      userData.mobilePhone = mobilePhone === "empty" ? null : mobilePhone;
    }

    const newUser = await new User(userData).save();

    if (!newUser) {
      return next({
        statusCode: 500,
        message: "There was an error creating this user.",
      });
    }

    // Populate portal before returning
    await newUser.populate("portalId");

    logger.info("User created successfully", {
      userId: newUser._id,
      email: newUser.email,
      createdBy: authUser.email,
    });

    res.status(200).json(newUser);
  } catch (error) {
    logger.error("Error creating user", {
      error: error instanceof Error ? error.message : error,
      email: req.body?.email,
    });
    return next({
      statusCode: 500,
      message: "There was an error creating this user.",
    });
  }
};

