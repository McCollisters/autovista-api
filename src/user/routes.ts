import { Router } from "express";
import { createUser } from "./controllers/createUser";
import { getUser } from "./controllers/getUser";
import { getUsers } from "./controllers/getUsers";
import { updateUser } from "./controllers/updateUser";
import { deleteUser } from "./controllers/deleteUser";
const router = Router();

router.get("/", getUsers);
router.post("/", createUser);
router.get("/:userId", getUser);
router.patch("/:userId", updateUser);
router.delete("/:userId", deleteUser);

export default router;
