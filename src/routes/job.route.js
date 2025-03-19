import express from "express";
import * as jobC from "../controllers/job.controller.js";

const router = express.Router();

router.post("/search", jobC.searchJob);
// router.post("/", jobC.createUser);

//art
router.get("/search/subcatagory/:sub_category_id", jobC.searchJobBySubcatagoryId);

export default router;
