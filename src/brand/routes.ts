import express from "express";
import { helloWorld } from "./controller";

const router = express.Router();

router.get("/", helloWorld);

export default router;
