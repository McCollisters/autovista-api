import express from "express";
import { User } from "@/_global/models";
import { Role } from "../schema";
import { Status } from "../../_global/enums";

export const createUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { portalId, role, portalRoles } = req.body;
    const userData: any = { ...req.body, status: Status.Active };

    const resolvedRole = role || Role.PortalUser;
    userData.role = resolvedRole;

    if (
      !portalRoles &&
      portalId &&
      (resolvedRole === Role.PortalAdmin || resolvedRole === Role.PortalUser)
    ) {
      userData.portalRoles = [{ portalId, role: resolvedRole }];
    }

    const createdUser = await new User(userData).save();
    res.status(200).send(createdUser);
  } catch (error) {
    console.error("Error creating portal:", error);
    res.status(500).json({ message: "Server error" });
  }
};
