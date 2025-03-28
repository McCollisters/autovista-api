import express from "express";
import { createUser } from "./controller";

const router = express.Router();

router.post("/", createUser);

export default router;
