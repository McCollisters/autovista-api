import express from "express";
import { User } from "@/_global/models";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";
import { Role } from "../schema";
import { logger } from "@/core/logger";
import { createToken } from "@/_global/utils/createToken";
import { getNotificationManager } from "@/notification";

export const updateUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    // Debug: log incoming update payload
    console.log("updateUser request", {
      params: req.params,
      body: req.body,
    });

    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      mobilePhone,
      role,
      status,
      portalId,
      portalRoles,
    } = req.body;

    // Get the authenticated user to check if they're an admin
    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));
    const isAdminUpdatingPassword =
      authUser &&
      (authUser.role === Role.PlatformAdmin ||
        authUser.role === Role.PlatformUser) &&
      typeof password !== "undefined";

    // If admin is updating password, get the user first to send reset email
    let userToUpdate = null;
    if (isAdminUpdatingPassword) {
      userToUpdate = await User.findById(req.params.userId);
      if (!userToUpdate) {
        return next({
          statusCode: 404,
          message: "User not found",
        });
      }
    }

    const update: Record<string, unknown> = {};

    if (typeof email !== "undefined") update.email = email;
    if (typeof password !== "undefined") update.password = password;
    if (typeof firstName !== "undefined") update.firstName = firstName;
    if (typeof lastName !== "undefined") update.lastName = lastName;
    if (typeof phone !== "undefined") update.phone = phone;
    if (typeof mobilePhone !== "undefined") update.mobilePhone = mobilePhone;
    if (typeof role !== "undefined") update.role = role;
    if (typeof status !== "undefined") {
      update.status =
        typeof status === "string" ? status.toLowerCase() : status;
    }
    if (typeof portalId !== "undefined") {
      update.portalId =
        portalId && typeof portalId === "object" && portalId._id
          ? portalId._id
          : portalId;
    }
    if (typeof portalRoles !== "undefined") {
      if (Array.isArray(portalRoles)) {
        update.portalRoles = portalRoles.map((entry) => ({
          portalId:
            entry?.portalId && typeof entry.portalId === "object" && entry.portalId._id
              ? entry.portalId._id
              : entry?.portalId,
          role: entry?.role,
        }));
      } else if (!portalRoles) {
        update.portalRoles = [];
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: update },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("portalId")
      .populate("portalRoles.portalId");

    // If admin updated password, send password reset email
    if (isAdminUpdatingPassword && userToUpdate && updatedUser) {
      try {
        // Create reset token (using JWT token) - use updatedUser in case role changed
        const token = createToken(updatedUser);
        const resetPasswordExpires = new Date(Date.now() + 3600000); // Expires in 1 hour

        // Use updated user's email in case it was also updated
        const recipientEmail = updatedUser.email || userToUpdate.email;
        const recipientFirstName = updatedUser.firstName || userToUpdate.firstName || "User";
        const resetUrl = `https://autovista.mccollisters.com/reset-password/${token}`;
        const html = `
          <p>Hi ${recipientFirstName},</p>
          <p>Your password has been updated by an administrator.</p>
          <p>You can reset your password by clicking <a href="${resetUrl}">this link.</a></p>
          <p>If you did not request this change, please contact us at autologistics@mccollisters.com.</p>
          <p>Thank you!</p>
          <p>The McCollister's Auto Logistics Team</p>
        `;

        const notificationManager = getNotificationManager();
        const result = await notificationManager.sendEmail({
          to: recipientEmail,
          from: "autologistics@mccollisters.com",
          subject: "Your AutoVista Password Has Been Updated",
          html,
          templateName: "Password Reset",
        });

        if (!result.success) {
          logger.error("Failed to send password reset email after admin update", {
            email: recipientEmail,
            error: result.error,
          });
          // Don't fail the request, just log the error
        } else {
          // Update user with reset token and expiration
          updatedUser.resetPasswordToken = token;
          updatedUser.resetPasswordExpires = resetPasswordExpires;
          await updatedUser.save();

          logger.info("Password reset email sent after admin password update", {
            email: recipientEmail,
            userId: updatedUser._id,
            updatedBy: authUser.email,
          });
        }
      } catch (emailError) {
        logger.error("Error sending password reset email after admin update", {
          error: emailError instanceof Error ? emailError.message : emailError,
          email: updatedUser?.email || userToUpdate?.email,
          userId: updatedUser?._id || userToUpdate?._id,
        });
        // Don't fail the request, just log the error
      }
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};
