import express from "express";

// รวม Route ต่างๆ ไว้ที่นี่
import dashboardRoute from "../routes/dashboard.route.js";
import jobRoute from "../routes/job.route.js";
const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: dashboard
 *     description: Dashboard related operations
 *   - name: jobs
 *     description: Job related operations
 */

router.use("/job", jobRoute); // จะให้ path '/api/users' ชี้ไปที่ user.route.js
router.use("/dashboard", dashboardRoute); // จะให้ path '/api/users' ชี้ไปที่ user.route.js

export default router;
