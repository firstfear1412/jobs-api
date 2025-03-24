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
export async function jobRatioBySubcategory(req, res) {
  console.log("query", req.query);
  console.log("query length ", Object.keys(req.query).length);
  console.log(
    `GET /jobRatioBySubcategory is requested by sub_category_id=${req.query.sub_category_id}`
  );

  try {
    let sub_category_id;
    
    // ถ้า req.query เป็น {} (ไม่มีการส่งค่า query มาเลย) ให้กำหนด sub_category_id เป็น null
    if (Object.keys(req.query).length === 0) {
      sub_category_id = null;
    }
    // ถ้าส่งค่ามาแต่ไม่ใช่ sub_category_id หรือเป็นค่าว่าง ให้โยน error
    else if (!req.query.sub_category_id || req.query.sub_category_id === "") {
      return res.status(400).json({ success: false, errormessage: "Status type is required: sub_category_id is missing or empty" });
    }
    // ถ้าค่าที่ส่งมาไม่ใช่ตัวเลข ให้โยน error
    else if (isNaN(req.query.sub_category_id)) {
      return res.status(400).json({ success: false, errormessage: "Status type is required: sub_category_id must be a number" });
    }
    else {
      sub_category_id = parseInt(req.query.sub_category_id, 10);
    }   

    const query = `
      WITH JobCounts AS (
          SELECT 
              COALESCE(s.name, 'Grand Total') AS sub_category_name, 
              COUNT(jc.job_id) AS total_jobs
          FROM classification jc
          INNER JOIN sub_category s ON jc.sub_category_id = s.sub_category_id
          WHERE ($1::INTEGER IS NULL OR s.sub_category_id = $1::INTEGER)

          GROUP BY GROUPING SETS ((s.name), ()) 
      )
      SELECT 
          sub_category_name,
          total_jobs
      FROM JobCounts
      ORDER BY total_jobs DESC NULLS LAST;
    `;

    const values = [sub_category_id]; 

    const result = await database.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, errormessage: `Data not found` });
    } else {
      return res.json({
        success: true,
        count: result.rows.length,
        data: result.rows,
      });
    }
  } catch (e) {
    console.error("Error executing jobRatioBySubcategory query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}

export async function jobRatioByType(req, res) {
  console.log("query", req.query);
  console.log("query length ", Object.keys(req.query).length);
  console.log(
    `GET /jobRatioByType is requested by type=${req.query.type}`
  );

  try {
    let type; // Full time, Contract/Temp, Contract/Temp, Part time, asual/Vacation

    // ถ้า req.query เป็น {} (ไม่มีการส่งค่า query มาเลย) ให้กำหนด type เป็น null
    if (Object.keys(req.query).length === 0) {
      type = null;
    }
    // ถ้าส่งค่ามาแต่ไม่ใช่ type หรือเป็นค่าว่าง ให้โยน error
    else if (!req.query.type || req.query.type === "") {
      return res.status(400).json({ success: false, errormessage: "Status type is required: type is missing or empty" });
    }
    else {
      type = req.query.type;
    }

    const query = `
      WITH JobCounts AS (
          SELECT 
              COALESCE(jb.type, 'Grand Total') AS type, 
              COUNT(jc.job_id) AS total_jobs
          FROM classification jc
          INNER JOIN sub_category s ON jc.sub_category_id = s.sub_category_id
          INNER JOIN basicinfo jb ON jc.job_id = jb.job_id
          WHERE ($1::VARCHAR  IS NULL OR jb.type ILIKE $1::VARCHAR)  
          GROUP BY GROUPING SETS ((jb.type), ())
      )
      SELECT 
          type,
          total_jobs
      FROM JobCounts
      ORDER BY total_jobs DESC NULLS LAST;
    `;

    const values = [type]; 
    const result = await database.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, errormessage: `Data not found` });
    } else {
      return res.json({
        success: true,
        data: result.rows,
      });
    }
  } catch (e) {
    console.error("Error executing jobRatioByType query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}

export async function jobCountByDate(req, res) {
  console.log("params", req.params);
  console.log("params length ", Object.keys(req.params).length);
  console.log(
    `GET /jobCountByDate is by ${req.params.day} days ago`
  );

  try {

    const day = req.params.day;  // รับค่าจาก params

    // ตรวจสอบว่ามีการส่งค่ามาไหม และค่าเป็นตัวเลข
    if (isNaN(day) || day <= 0) {
      return res.status(400).json({ 
        success: false, 
        errormessage: "Invalid day parameter. Please provide a valid positive number." 
      });
    }

    const query = `
      SELECT COUNT(jb.job_id) AS total_jobs
      FROM basicinfo jb
      WHERE posted_date >= NOW() - INTERVAL '${day} days'
    `;

    const result = await database.query(query);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, errormessage: `Data not found` });
    } else {
      return res.json({
        success: true,
        message: `The total number of job postings in the past ${day} days.`,
        data: result.rows,
      });
    }
  } catch (e) {
    console.error("Error executing jobCountByDate query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}

export async function jobRatioByLocation(req, res) {
  console.log("query", req.query);
  console.log("query length ", Object.keys(req.query).length);
  console.log(
    `GET /jobRatioByLocation is requested by city=${req.query.city}`
  );

  try {
    let city; // Full time, Contract/Temp, Contract/Temp, Part time, asual/Vacation

    // ถ้า req.query เป็น {} (ไม่มีการส่งค่า query มาเลย) ให้กำหนด city เป็น null
    if (Object.keys(req.query).length === 0) {
      city = null;
    }
    // ถ้าส่งค่ามาแต่ไม่ใช่ city หรือเป็นค่าว่าง ให้โยน error
    else if (!req.query.city || req.query.city === "") {
      return res.status(400).json({ success: false, errormessage: "Status city is required: city is missing or empty" });
    }
    else {
      city = req.query.city;
    }
    // WHERE ($1::VARCHAR  IS NULL OR jb.type ILIKE $1::VARCHAR)  
    const query = `
      WITH JobCounts AS (
          SELECT
              COALESCE(area, 'Unknown') AS area,  
              COALESCE(city, 'Unknown') AS city,  
          COALESCE(country, 'Unknown') AS country,  
              COUNT(job_id) AS total_jobs
          FROM location
          WHERE ($1::VARCHAR  IS NULL OR city ILIKE $1::VARCHAR)  
          GROUP BY area, country, city
      )
      SELECT 
        area, 
          city,
        country,
          total_jobs
      FROM JobCounts
      ORDER BY 
      area DESC NULLS LAST, 
      country DESC NULLS LAST, 
      city DESC NULLS LAST;

    `;

    const values = [city]; 
    const result = await database.query(query, values);    

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, errormessage: `Data not found` });
    } else {
      return res.json({
        success: true,
        data: result.rows,
      });
    }
    
  } catch (e) {
    console.error("Error executing jobRatioByLocation query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}