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
      text: `
        SELECT 
            js."skill_name",
            COUNT(j."job_id") AS job_count
        FROM "jobs" j
        JOIN salary s ON s."job_id" = j."job_id"
        JOIN basicInfo b ON b."job_id" = j."job_id"
        JOIN company c ON c."company_id" = j."company_id"
        JOIN jobs_skill_status jss ON jss.job_id = j.job_id AND jss.has_extracted_skill = true 
        JOIN jobs_skill js ON js."job_id" = j."job_id" AND js."skill_type" = $1
        GROUP BY js."skill_name"
        ORDER BY job_count DESC, skill_name
        LIMIT 5`,
      values: [req.params.type],
    });
    if (result.rowsCount == 0) {
      return res
        .status(404)
        .json({ success: false, errormessage: `Data not found` });
    } else {
      const sumJobCount = result.rows.reduce(
        (sum, row) => sum + parseInt(row.job_count, 10),
        0
      );
      return res.json({
        success: true,
        count: result.rows.length,
        sumJobCount: sumJobCount,
        data: result.rows,
      });
    }
  } catch (ex) {
    return res.status(500).json({ success: false, errormessage: ex.message });
  }
}

export async function jobByRangeSalary(req, res) {
  console.log("params", req.query);
  console.log(
    `GET /jobByRangeSalary is requested by min=${req.query.min} and max=${req.query.max}`
  );
  try {
    // ตรวจสอบค่า min และ max เป็น null หรือไม่
    const min_salary =
      req.query.min === "null" ? null : parseFloat(req.query.min);
    const max_salary =
      req.query.max === "null" ? null : parseFloat(req.query.max);

    // Validate if min_salary and max_salary are valid numbers
    if (
      (min_salary !== null && isNaN(min_salary)) ||
      (max_salary !== null && isNaN(max_salary))
    ) {
      return res
        .status(400)
        .json({ success: false, errormessage: "Invalid salary range" });
    }
    //#region query
    const query = `
      WITH vars AS(
        SELECT 
        $1::numeric AS min_salary,
        $2::numeric AS max_salary
      )
      SELECT j.job_id, 
        j.company_id,
        c.name AS company_name,
        c.short_name AS short_name,
        c.industry,
        c.company_size AS company_size,
        lo.city,
        lo.area,
        lo.country,
        csf.main_category AS main_category,
        csf.sub_category AS sub_category,
        sa.min_salary,
        sa.max_salary,
        sa.currency,
        sa.period,
        bi.title,
        bi.type,
        bi.status,
        bi.posted_date,
        content
      FROM "jobs" j
      LEFT JOIN (
        SELECT job_id, title, type, status, posted_date
        FROM "basicinfo"
      ) bi
      ON bi.job_id = j.job_id
      LEFT JOIN (
        SELECT job_id, main_category_id
        FROM "classification"
      ) cf
      ON cf.job_id = j.job_id
      LEFT JOIN (
        SELECT main_category_id, name
        FROM "main_category"
      ) mc
      ON mc.main_category_id = cf.main_category_id
      LEFT JOIN (
        SELECT job_id, min_salary, max_salary, currency, period, has_salary_info
        FROM "salary"
      ) sa
      ON sa.job_id = j.job_id
      LEFT JOIN (
        SELECT job_id, area, city, country
        FROM location
      ) lo
      ON lo.job_id = j.job_id
      LEFT JOIN (
        SELECT company_id, name, short_name, industry, company_size
        FROM company
      ) c
      ON c.company_id = j.company_id
      LEFT JOIN (
        SELECT job_id, c.main_category_id, mc.name AS main_category, c.sub_category_id, sc.name AS sub_category
        FROM classification c
        INNER JOIN main_category mc ON mc.main_category_id = c.main_category_id
        INNER JOIN sub_category sc ON sc.sub_category_id = c.sub_category_id
      ) csf
      ON csf.job_id = j.job_id
      CROSS JOIN vars
      WHERE
        sa.has_salary_info = 1
        AND sa.min_salary IS NOT NULL AND sa.min_salary <> 0
        AND sa.max_salary IS NOT NULL AND sa.max_salary <> 0
      -- 	AND
        -- (
        -- 	(sa.min_salary BETWEEN COALESCE(vars.min_salary,sa.min_salary) AND COALESCE(vars.max_salary,sa.max_salary))
        -- 	OR
        -- 	(sa.max_salary BETWEEN COALESCE(vars.min_salary,sa.min_salary) AND COALESCE(vars.max_salary,sa.max_salary))
        -- 	OR
        -- 	(
        -- 		(sa.min_salary <= COALESCE(vars.min_salary,sa.min_salary))
        -- 		AND
        -- 		(sa.max_salary >= COALESCE(vars.max_salary,sa.max_salary))
        -- 	)
        -- )
        
            AND 
          (-- short query
            sa.min_salary <= COALESCE(vars.max_salary, sa.min_salary) 
                AND 
            sa.max_salary >= COALESCE(vars.min_salary, sa.max_salary)
            )
      ORDER BY bi.posted_date DESC ,sa.min_salary DESC, sa.max_salary DESC, c.name

      `;
    //#endregion query

    const values = [min_salary, max_salary];

    const result = await database.query(query, values);
    if (result.rowsCount == 0) {
      return res
        .status(404)
        .json({ success: false, errormessage: `Data not found` });
    } else {
      return res.json({
        success: true,
        count: result.rows.length,
        data: result.rows,
      });
    }
  } catch (e) {
    console.error("Error executing jobByRangeSalary query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}
//max

//art
