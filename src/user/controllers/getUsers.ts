import express from "express";
import { User } from "@/_global/models";
import { Status } from "../../_global/enums";

export const getUsers = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { portalId, role } = req.query;
    let filter: any = { status: Status.Active };

    if (portalId) {
      filter.$or = [{ portalId }, { "portalRoles.portalId": portalId }];
    }

    if (role) {
      const roleFilter = [
        { role },
        { "portalRoles.role": role },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: roleFilter }];
        delete filter.$or;
      } else {
        filter.$or = roleFilter;
      }
    }

    const users = await User.find(filter)
      .populate("portalId")
      .populate("portalRoles.portalId");
    const usersWithLastName = [];
    const usersWithoutLastName = [];

    users.forEach((user) => {
      if (user.lastName) {
        usersWithLastName.push(user);
      } else {
        usersWithoutLastName.push(user);
      }
    });

    usersWithLastName.sort((a, b) => {
      const aLastName = (a.lastName || "").toLowerCase();
      const bLastName = (b.lastName || "").toLowerCase();
      if (aLastName !== bLastName) {
        return aLastName.localeCompare(bLastName);
      }
      const aFirstName = (a.firstName || "").toLowerCase();
      const bFirstName = (b.firstName || "").toLowerCase();
      return aFirstName.localeCompare(bFirstName);
    });

    const sortedUsers = usersWithLastName.concat(usersWithoutLastName);

    res.status(200).json(sortedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
};
