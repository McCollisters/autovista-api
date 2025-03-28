import { Router } from "express";
import { 
  getUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser
} from "./controller";

const router = Router(); 

router.get("/", getUsers);
router.post("/", createUser);
router.get("/:userId", getUser); 
router.put("/:userId", updateUser); 
router.delete("/:userId",deleteUser); 

export default router; 
