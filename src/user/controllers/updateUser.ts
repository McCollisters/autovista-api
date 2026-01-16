import express from "express";
import { User } from "@/_global/models";

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
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};
