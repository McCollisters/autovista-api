import { Types } from "mongoose";
import { IUser, Role } from "@/user/schema";

export interface PortalRoleEntry {
  portalId: Types.ObjectId | string;
  role: Role;
}

const normalizePortalId = (portalId: any): string => {
  if (!portalId) {
    return "";
  }
  if (typeof portalId === "string") {
    return portalId;
  }
  if (portalId?._id) {
    return portalId._id.toString();
  }
  if (typeof portalId.toString === "function") {
    return portalId.toString();
  }
  return "";
};

export const isPlatformRole = (role?: string): boolean =>
  role === Role.PlatformAdmin || role === Role.PlatformUser;

export const getPortalRoles = (user?: IUser | null): PortalRoleEntry[] => {
  if (!user) {
    return [];
  }
  const portalRoles = Array.isArray(user.portalRoles) ? user.portalRoles : [];
  if (portalRoles.length > 0) {
    return portalRoles
      .filter((entry) => entry?.portalId)
      .map((entry) => ({
        portalId: entry.portalId,
        role: entry.role,
      }));
  }

  if (
    user.portalId &&
    (user.role === Role.PortalAdmin || user.role === Role.PortalUser)
  ) {
    return [{ portalId: user.portalId, role: user.role }];
  }

  return [];
};

export const getPortalRoleSets = (user?: IUser | null) => {
  const portalRoles = getPortalRoles(user);
  const adminPortalIds: string[] = [];
  const userPortalIds: string[] = [];

  portalRoles.forEach((entry) => {
    const portalId = normalizePortalId(entry.portalId);
    if (!portalId) {
      return;
    }
    if (entry.role === Role.PortalAdmin) {
      adminPortalIds.push(portalId);
    }
    if (entry.role === Role.PortalUser) {
      userPortalIds.push(portalId);
    }
  });

  return { adminPortalIds, userPortalIds };
};

export const hasPortalAccess = (
  user: IUser | null | undefined,
  portalId: string,
): boolean => {
  if (!user || !portalId) {
    return false;
  }
  if (isPlatformRole(user.role)) {
    return true;
  }
  const normalizedPortalId = normalizePortalId(portalId);
  const { adminPortalIds, userPortalIds } = getPortalRoleSets(user);
  return (
    adminPortalIds.includes(normalizedPortalId) ||
    userPortalIds.includes(normalizedPortalId)
  );
};
