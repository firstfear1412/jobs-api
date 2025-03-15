import database from "../config/db.config.js";

//ter
export async function topSkillByPost(req, res) {
  console.log(`GET /topSkillByPost skillType=${req.params.type} is request`);
  if (req.params.type == null || req.params.type == "") {
    return res
      .status(400)
      .json({ success: false, errormessage: "type is required" });
  }
  try {
    const result = await database.query({
      text: `SELECT 
               js."skill_name",
               COUNT(j."job_id") AS job_count
          FROM "jobs" j
          JOIN salary s ON s."job_id" = j."job_id" --AND s."has_salary_info" = 1
          JOIN basicInfo b ON b."job_id" = j."job_id"
          JOIN company c ON c."company_id" = j."company_id"
          JOIN jobs_skill js ON js."job_id" = j."job_id" AND js."skill_type" = $1
          --ORDER BY s."max_salary" DESC
          GROUP BY js."skill_name"
          ORDER BY job_count DESC, skill_name DESC
          LIMIT 5`,
      values: [req.params.type],
    });
    if (result.rowsCount == 0) {
      return res
        .status(404)
        .json({ success: false, errormessage: `Data not found` });
    } else {
      return res.json({ success: true, data: result.rows });
    }
  } catch (ex) {
    return res.status(500).json({ success: false, errormessage: ex.message });
  }
}

//max

//art
