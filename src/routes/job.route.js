import express from "express";
import * as jobC from "../controllers/job.controller.js";

const router = express.Router();

router.post("/search", jobC.searchJob);
// router.post("/", jobC.createUser);

//art
router.get("/subcatagory/:sub_category_id", jobC.fetchJobBySubcatagoryId);
router.post("/date-range", jobC.fetchJobByDateRange);


export default router;
