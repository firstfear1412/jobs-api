import express from "express";
import * as jobC from "../controllers/job.controller.js";

const router = express.Router();

router.get("/", jobC.chkCart);
// router.post("/", jobC.createUser);

export default router;
