import express from "express";
import { User } from "@/_global/models";
import { Role } from "../schema";
import { Status } from "../../_global/enums";
import { resolveId } from "@/_global/utils/resolveId";

export const createUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { portalId, role, portalRoles } = req.body;
    const resolvedPortalId = resolveId(portalId);
    const userData: any = { ...req.body, status: Status.Active };

    const resolvedRole = role || Role.PortalUser;
    userData.role = resolvedRole;

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

    if (resolvedPortalId) {
      userData.portalId = resolvedPortalId;
    }

    const createdUser = await new User(userData).save();
    res.status(200).send(createdUser);
  } catch (error) {
    console.error("Error creating portal:", error);
    res.status(500).json({ message: "Server error" });
  }
};
