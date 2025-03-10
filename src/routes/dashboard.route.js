import express from "express";
import * as dashboardC from "../controllers/dashboard.controller.js";

const router = express.Router();

router.get("/topSkillByPost/:type", dashboardC.topSkillByPost);
// router.get("/topSkillByPost", dashboardC.topSkillByPost);
// router.post("/", dashboardC.createUser);

export default router;
