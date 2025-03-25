import express from "express";
import * as dashboardC from "../controllers/dashboard.controller.js";

const router = express.Router();

router.get("/topSkillByPost/:type", dashboardC.topSkillByPost);
router.get("/avgSalary", dashboardC.avgSalary);
// router.get("/topSkillByPost", dashboardC.topSkillByPost);
// router.post("/", dashboardC.createUser);

// art
router.get("/jobRatioBySubcategory", dashboardC.jobRatioBySubcategory);
router.get("/jobRatioByType", dashboardC.jobRatioByType);
router.get("/jobRatioBylocation", dashboardC.jobRatioByLocation);
router.get("/jobCountByDate/:day", dashboardC.jobCountByDate);

export default router;
