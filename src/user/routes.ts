import { Router } from "express";
import { createUser } from "./controllers/createUser";
import { createUserAdmin } from "./controllers/createUserAdmin";
import { getUser } from "./controllers/getUser";
import { getAuthorizedUser } from "./controllers/getAuthorizedUser";
import { getUsers } from "./controllers/getUsers";
import { getUsersByPortal } from "./controllers/getUsersByPortal";
import { updateUser } from "./controllers/updateUser";
import { deleteUser } from "./controllers/deleteUser";

const router = Router();

// Get current authorized user (GET /api/v1/user)
router.get("/", getAuthorizedUser);

// Get users by portal
router.get("/users/portal/:portalId", getUsersByPortal);

// Admin-only: Create user
router.post("/admin/user", createUserAdmin);

// User CRUD operations
router.post("/", createUser);
router.get("/:userId", getUser);
router.patch("/:userId", updateUser);
router.delete("/:userId", deleteUser);

export default router;
