import express from "express";
import * as dashboardC from "../controllers/dashboard.controller.js";

const router = express.Router();

router.get("/topSkillByPost/:type", dashboardC.topSkillByPost);
router.get("/avgSalary", dashboardC.avgSalary);
// router.get("/topSkillByPost", dashboardC.topSkillByPost);
// router.post("/", dashboardC.createUser);

//max
router.post("/jobByStatus", dashboardC.jobByStatus);
router.post("/jobByMaxSalary", dashboardC.jobByMaxSalary);
router.post("/jobByMinSalary", dashboardC.jobByMinSalary);
router.get("/jobByIndustry", dashboardC.jobByIndustry);
router.get("/jobByIndustry/:industry", dashboardC.jobByIndustry);
router.get("/jobByComponySize", dashboardC.jobByComponySize);
router.get("/jobByComponySize/:componySize", dashboardC.jobByComponySize);

// art
router.get("/jobRatioBySubcategory", dashboardC.jobRatioBySubcategory);
router.get("/jobRatioByType", dashboardC.jobRatioByType);
router.get("/jobRatioBylocation", dashboardC.jobRatioByLocation);
router.get("/jobCountByDate/:day", dashboardC.jobCountByDate);

export default router;
