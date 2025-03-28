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
            COUNT(j."job_id")::INTEGER AS job_count
        FROM "jobs" j
        JOIN salary s ON s."job_id" = j."job_id"
        JOIN basicInfo b ON b."job_id" = j."job_id"
        JOIN company c ON c."company_id" = j."company_id"
        JOIN jobs_skill_status jss ON jss.job_id = j.job_id AND jss.has_extracted_skill = true 
        JOIN jobs_skill js ON js."job_id" = j."job_id" AND js."skill_type" ILIKE $1
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
        countObj: result.rows.length,
        total: sumJobCount,
        data: result.rows,
      });
    }
  } catch (ex) {
    return res.status(500).json({ success: false, errormessage: ex.message });
  }
}

export async function avgSalary(req, res) {
  console.log("params", req.query);
  console.log(`GET /avgSalary is requested by city=${req.query.city}`);
  try {
    // ตรวจสอบค่า min และ max เป็น null หรือไม่
    const city = req.query.city === undefined ? null : req.query.city;
    //#region query
    const query = `
        SELECT MIN(max_salary)::FLOAT AS min_salary, MAX(max_salary)::FLOAT AS max_salary, ROUND(AVG(max_salary)::numeric, 2)::FLOAT AS avg_salary
        FROM
        (
          WITH vars AS(
            SELECT 
            $1::text AS city
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
          AND currency = 'THB'
          AND period = 'monthly'
          AND (vars.city IS NULL OR lo.city ILIKE vars.city)
          ORDER BY bi.posted_date DESC ,sa.min_salary DESC, sa.max_salary DESC, c.name
        )
      `;
    //#endregion query

    const values = [city];

    const result = await database.query(query, values);
    if (
      !result.rows.length ||
      (result.rows[0].min_salary === null &&
        result.rows[0].max_salary === null &&
        result.rows[0].avg_salary === null)
    ) {
      return res
        .status(404)
        .json({ success: false, errormessage: `Data not found` });
    } else {
      return res.json({
        success: true,
        countObj: result.rows.length,
        // total: total,
        data: result.rows,
      });
    }
  } catch (e) {
    console.error("Error executing jobByRangeSalary query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}
//max
export async function jobByStatus(req, res) {
  console.log("body", req.body);

  const status = req.body.status || null;
  const limit = req.body.limit || 0;
  const offset = req.body.offset || 0;
  console.log(`POST /jobByStatus is requested by ${status}`);

  try {
    let query = "";
    let values = [];

    if (!status) {
      query = `
        SELECT
          jb.status,
          COUNT(*)::INTEGER as total
        FROM jobs j
        INNER JOIN basicinfo jb ON j.job_id = jb.job_id
        GROUP BY jb.status
      `;
      if (limit == 0) {
        query += ` LIMIT $1 OFFSET $2`;
        values = [limit, offset];
      }
    } else {
      query = `
        SELECT
          j.job_id,
          cm.company_id,
          cm.name AS company_name, 
          cm.short_name,
          cm.industry,
          cm.company_size,
          cm.company_search_url,
          jl.area,
          jl.city,
          jl.country,
          jb.title,
          jb.type,
          m.main_category_id,
          m.name AS main_category_name,
          s.sub_category_id,
          s.name AS sub_category_name,
          jsr.min_salary::DECIMAL,
          jsr.max_salary::DECIMAL,
          jsr.currency,
          jsr.period,
          jb.status,
          jb.posted_date,
          jb.expiry_date,
          j.content,
          j.share_link,
          (
            SELECT json_agg(js.skill_name)
            FROM jobs_skill js 
            WHERE js.job_id = j.job_id AND js.skill_type = 'soft_skill'
          ) AS soft_skills,
          (
            SELECT json_agg(js.skill_name)
            FROM jobs_skill js 
            WHERE js.job_id = j.job_id AND js.skill_type = 'hard_skill'
          ) AS hard_skills
        FROM jobs j
        INNER JOIN company cm ON j.company_id = cm.company_id
        INNER JOIN location jl ON j.job_id = jl.job_id
        INNER JOIN basicinfo jb ON j.job_id = jb.job_id
        LEFT JOIN salary jsr ON j.job_id = jsr.job_id
        INNER JOIN classification c ON j.job_id = c.job_id
        LEFT JOIN main_category m ON c.main_category_id = m.main_category_id
        LEFT JOIN sub_category s ON c.sub_category_id = s.sub_category_id
        WHERE jb.status ILIKE $1
      `;
      if (limit !== 0) {
        query += ` LIMIT $2 OFFSET $3`;
        values = [`%${status}%`, limit, offset];
      } else {
        values = [`%${status}%`];
      }
    }

    const result = await database.query(query, values);

    if (result.rowCount == 0) {
      return res.status(404).json({
        success: false,
        errormessage: "Data not found",
      });
    }

    let data = [];
    if (status) {
      data = result.rows.map((row) => ({
        job_id: row.job_id,
        basicInfo: {
          title: row.title,
          type: row.type,
          status: row.status,
          postedDate: row.posted_date,
          expiryDate: row.expiry_date,
        },
        salary: {
          minSalary: row.min_salary,
          maxSalary: row.max_salary,
          currency: row.currency,
          period: row.period,
        },
        classification: {
          mainCategory: {
            id: row.main_category_id,
            name: row.main_category_name,
          },
          subCategory: {
            id: row.sub_category_id,
            name: row.sub_category_name,
          },
        },
        location: {
          area: row.area,
          city: row.city,
          country: row.country,
        },
        company: {
          id: row.company_id,
          name: row.company_name,
          shortName: row.short_name,
          industry: row.industry,
          size: row.company_size,
          companySearchUrl: row.company_search_url,
        },
        content: row.content,
        extractSkills: {
          hardSkill: row.hard_skills,
          softSkill: row.soft_skills,
        },
        shareLink: row.share_link,
      }));
    } else {
      data = result.rows; // Just return raw data if no status
    }
    const total = result.rows.reduce(
      (sum, row) => sum + parseInt(row.total || 0, 10),
      0
    );
    if (total > 0) {
      return res.json({
        success: true,
        countObj: result.rowCount,
        total,
        data,
      });
    } else {
      return res.json({
        success: true,
        countObj: result.rowCount,
        data,
      });
    }
  } catch (e) {
    console.error("Error executing jobByStatus query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}
export async function jobByMaxSalary(req, res) {
  console.log(`POST /jobByMaxSalary is requested by `, req.body);
  const top = req.body.top || 5;
  const subCategoryName = req.body.subCategoryName || null;

  try {
    let values = [];
    let query = "";

    if (!subCategoryName) {
      query = `
      SELECT 
        sc.sub_category_id, 
        sc.name AS sub_category_name,
        MAX(jsr.max_salary)::DECIMAL AS max_salary
      FROM sub_category sc
      INNER JOIN classification c_inner ON sc.sub_category_id = c_inner.sub_category_id
      INNER JOIN salary jsr ON c_inner.job_id = jsr.job_id 
      WHERE jsr.has_salary_info = 1
      GROUP BY sc.sub_category_id, sc.name
      ORDER BY max_salary DESC
      LIMIT $1;
      `;
      values = [top];
    } else {
      query = `
          SELECT
              cm.company_id,
              cm.name AS company_name, 
              cm.short_name,
              cm.industry,
              cm.company_size,
              MAX(jsr.max_salary)::DECIMAL AS max_salary
          FROM sub_category sc
          INNER JOIN classification c_inner ON sc.sub_category_id = c_inner.sub_category_id
          INNER JOIN salary jsr ON c_inner.job_id = jsr.job_id 
          INNER JOIN jobs j ON j.job_id = c_inner.job_id
          INNER JOIN company cm ON j.company_id = cm.company_id
          WHERE jsr.has_salary_info = 1 
          AND sc."name" ILIKE  $1 
          GROUP BY  
              cm.company_id, 
              cm.name, 
              cm.short_name, 
              cm.industry,
              sc."name" ,
              jsr.max_salary, 
              cm.company_size
          ORDER BY max_salary DESC
          LIMIT $2;
      `;
      values = [`%${subCategoryName}%`, top];
    }

    const result = await database.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        errormessage: "Data not found",
      });
    } else {
      return res.status(200).json({
        success: true,
        countObj: result.rows.length,
        data: result.rows,
      });
    }
  } catch (e) {
    console.error("Error executing jobByMaxSalary query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}

export async function jobByMinSalary(req, res) {
  console.log(`POST /jobByMinSalary is requested by `, req.body);
  const top = req.body.top || 5;
  const subCategoryName = req.body.subCategoryName || null;

  try {
    let values = [];
    let query = "";

    if (!subCategoryName) {
      query = `
      SELECT 
        sc.sub_category_id, 
        sc.name AS sub_category_name,
        MIN(jsr.min_salary)::DECIMAL AS min_salary
      FROM sub_category sc
      INNER JOIN classification c_inner ON sc.sub_category_id = c_inner.sub_category_id
      INNER JOIN salary jsr ON c_inner.job_id = jsr.job_id 
      WHERE jsr.has_salary_info = 1 AND jsr.currency LIKE 'THB' AND jsr."period" LIKE 'monthly'
      GROUP BY sc.sub_category_id, sc.name
      ORDER BY min_salary ASC
      LIMIT $1;
      `;
      values = [top];
    } else {
      query = `
      SELECT 
        cm.company_id,
        cm.name AS company_name, 
        cm.short_name,
        cm.industry,
        cm.company_size,
        sc."name" AS job_name,
        jsr.min_salary ::DECIMAL
      FROM sub_category sc
      INNER JOIN classification c_inner ON sc.sub_category_id = c_inner.sub_category_id
      INNER JOIN salary jsr ON c_inner.job_id = jsr.job_id 
      INNER JOIN jobs j ON j.job_id = c_inner.job_id
      INNER JOIN company cm ON j.company_id = cm.company_id
      WHERE jsr.has_salary_info = 1 
      AND sc."name" ILIKE '%' || $1 || '%' AND jsr.currency LIKE 'THB' AND jsr."period" LIKE 'monthly'
      GROUP BY  
              cm.company_id, 
              cm.name, 
              cm.short_name, 
              cm.industry,
              sc."name" ,
              jsr.min_salary, 
              cm.company_size
      ORDER BY jsr.min_salary ASC
      LIMIT $2;
      `;
      values = [subCategoryName, top];
    }

    const result = await database.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        errormessage: "Data not found",
      });
    } else {
      return res.status(200).json({
        success: true,
        countObj: result.rows.length,
        data: result.rows,
      });
    }
  } catch (e) {
    console.error("Error executing jobByMinSalary query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}
export async function jobByIndustry(req, res) {
  const industry = req.params.industry;
  console.log(`GET /jobByIndustry is requested by `, industry);

  try {
    let query = "";
    let values = [];

    // กรณีไม่ได้ส่ง industry มา แสดงจำนวนตาม industry
    if (!industry) {
      query = `
        SELECT 
          COALESCE(industry, 'ไม่ได้ระบุ') AS industry,
          COUNT(*)::INTEGER AS total
        FROM 
          company
        GROUP BY 
          industry
        ORDER BY 
          total DESC
      `;
    }
    // กรณีที่ต้องการดูงาน industry ที่เป็น NULL
    else if (industry.toLowerCase() == "null") {
      query = `
        SELECT
          j.job_id,
          cm.company_id,
          cm.name AS company_name, 
          cm.short_name,
          cm.industry,
          cm.company_size,
          cm.company_search_url,
          jl.area,
          jl.city,
          jl.country,
          jb.title,
          jb.type,
          m.main_category_id,
          m.name AS main_category_name,
          s.sub_category_id,
          s.name AS sub_category_name,
          jsr.min_salary::DECIMAL,
          jsr.max_salary::DECIMAL,
          jsr.currency,
          jsr.period,
          jb.status,
          jb.posted_date,
          jb.expiry_date,
          j.content,
          j.share_link,
          (
            SELECT json_agg(js.skill_name)
            FROM jobs_skill js 
            WHERE js.job_id = j.job_id AND js.skill_type = 'soft_skill'
          ) AS soft_skills,
          (
            SELECT json_agg(js.skill_name)
            FROM jobs_skill js 
            WHERE js.job_id = j.job_id AND js.skill_type = 'hard_skill'
          ) AS hard_skills
        FROM jobs j
        INNER JOIN company cm ON j.company_id = cm.company_id
        INNER JOIN location jl ON j.job_id = jl.job_id
        INNER JOIN basicinfo jb ON j.job_id = jb.job_id
        LEFT JOIN salary jsr ON j.job_id = jsr.job_id
        INNER JOIN classification c ON j.job_id = c.job_id
        INNER JOIN main_category m ON c.main_category_id = m.main_category_id
        INNER JOIN sub_category s ON c.sub_category_id = s.sub_category_id
        WHERE cm.industry IS NULL
        GROUP BY
          j.job_id,
          cm.company_id,
          cm.name,
          cm.short_name,
          cm.industry,
          cm.company_size,
          cm.company_search_url,
          jl.area,
          jl.city,
          jl.country,
          jb.title,
          jb.type,
          m.main_category_id,
          m.name,
          s.sub_category_id,
          s.name,
          jsr.min_salary,
          jsr.max_salary,
          jsr.currency,
          jsr.period,
          jb.status,
          jb.posted_date,
          jb.expiry_date,
          j.content,
          j.share_link
      `;
    }
    // กรณีที่ต้องการดูงานตาม industry ที่ไม่ได้มีค่า null
    else {
      query = `
        SELECT
          j.job_id,
          cm.company_id,
          cm.name AS company_name, 
          cm.short_name,
          cm.industry,
          cm.company_size,
          cm.company_search_url,
          jl.area,
          jl.city,
          jl.country,
          jb.title,
          jb.type,
          m.main_category_id,
          m.name AS main_category_name,
          s.sub_category_id,
          s.name AS sub_category_name,
          jsr.min_salary,
          jsr.max_salary,
          jsr.currency,
          jsr.period,
          jb.status,
          jb.posted_date,
          jb.expiry_date,
          j.content,
          j.share_link,
          (
            SELECT json_agg(js.skill_name)
            FROM jobs_skill js 
            WHERE js.job_id = j.job_id AND js.skill_type = 'soft_skill'
          ) AS soft_skills,
          (
            SELECT json_agg(js.skill_name)
            FROM jobs_skill js 
            WHERE js.job_id = j.job_id AND js.skill_type = 'hard_skill'
          ) AS hard_skills
        FROM jobs j
        INNER JOIN company cm ON j.company_id = cm.company_id
        INNER JOIN location jl ON j.job_id = jl.job_id
        INNER JOIN basicinfo jb ON j.job_id = jb.job_id
        INNER JOIN salary jsr ON j.job_id = jsr.job_id
        INNER JOIN classification c ON j.job_id = c.job_id
        INNER JOIN main_category m ON c.main_category_id = m.main_category_id
        INNER JOIN sub_category s ON c.sub_category_id = s.sub_category_id
        WHERE cm.industry ILIKE $1
        GROUP BY
          j.job_id,
          cm.company_id,
          cm.name,
          cm.short_name,
          cm.industry,
          cm.company_size,
          cm.company_search_url,
          jl.area,
          jl.city,
          jl.country,
          jb.title,
          jb.type,
          m.main_category_id,
          m.name,
          s.sub_category_id,
          s.name,
          jsr.min_salary,
          jsr.max_salary,
          jsr.currency,
          jsr.period,
          jb.status,
          jb.posted_date,
          jb.expiry_date,
          j.content,
          j.share_link`;
      values = [`%${industry}%`];
    }

    const result = await database.query(query, values);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, errormessage: `Data not found` });
    }
    let data = [];
    if (industry) {
      data = result.rows.map((row) => ({
        job_id: row.job_id,
        basicInfo: {
          title: row.title,
          type: row.type,
          status: row.status,
          postedDate: row.posted_date,
          expiryDate: row.expiry_date,
        },
        salary: {
          minSalary: row.min_salary,
          maxSalary: row.max_salary,
          currency: row.currency,
          period: row.period,
        },
        classification: {
          mainCategory: {
            id: row.main_category_id,
            name: row.main_category_name,
          },
          subCategory: {
            id: row.sub_category_id,
            name: row.sub_category_name,
          },
        },
        location: {
          area: row.area,
          city: row.city,
          country: row.country,
        },
        company: {
          id: row.company_id,
          name: row.company_name,
          shortName: row.short_name,
          industry: row.industry,
          size: row.company_size,
          companySearchUrl: row.company_search_url,
        },
        content: row.content,
        extractSkills: {
          hardSkill: row.hard_skills,
          softSkill: row.soft_skills,
        },
        shareLink: row.share_link,
      }));
    } else {
      data = result.rows; // Just return raw data if no status
    }

    const total = result.rows.reduce(
      (sum, row) => sum + parseInt(row.total || 0, 10),
      0
    );
    if (total) {
      return res.json({
        success: true,
        countObj: result.rows.length,
        total,
        data,
      });
    }
    return res.json({
      success: true,
      countObj: result.rows.length,
      data,
    });
  } catch (e) {
    console.error("Error executing jobByIndustry query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}

export async function jobBycompanySize(req, res) {
  const companySize = req.params.companySize;
  console.log(`GET /jobBycompanySize is requested by `, companySize);
  try {
    let values = [];
    let query = "";

    if (!companySize) {
      query = `
              SELECT COALESCE(cm.company_size,'Null') as company_size,
                COUNT(j.job_id)::INTEGER AS total
              FROM jobs j
              INNER JOIN company cm ON j.company_id = cm.company_id
              GROUP BY cm.company_size
              ORDER BY total DESC;
      `;
    } else if (companySize.toLowerCase() == "null") {
      query = `
        SELECT
          j.job_id,
          cm.company_id,
          cm.name AS company_name, 
          cm.short_name,
          cm.industry,
          cm.company_size,
          cm.company_search_url,
          jl.area,
          jl.city,
          jl.country,
          jb.title,
          jb.type,
          m.main_category_id,
          m.name AS main_category_name,
          s.sub_category_id,
          s.name AS sub_category_name,
          jsr.min_salary::DECIMAL,
          jsr.max_salary::DECIMAL,
          jsr.currency,
          jsr.period,
          jb.status,
          jb.posted_date,
          jb.expiry_date,
          j.content,
          j.share_link,
          (
            SELECT json_agg(js.skill_name)
            FROM jobs_skill js 
            WHERE js.job_id = j.job_id AND js.skill_type = 'soft_skill'
          ) AS soft_skills,
          (
            SELECT json_agg(js.skill_name)
            FROM jobs_skill js 
            WHERE js.job_id = j.job_id AND js.skill_type = 'hard_skill'
          ) AS hard_skills
        FROM jobs j
        INNER JOIN company cm ON j.company_id = cm.company_id
        INNER JOIN location jl ON j.job_id = jl.job_id
        INNER JOIN basicinfo jb ON j.job_id = jb.job_id
        LEFT JOIN salary jsr ON j.job_id = jsr.job_id
        INNER JOIN classification c ON j.job_id = c.job_id
        LEFT JOIN main_category m ON c.main_category_id = m.main_category_id
        LEFT JOIN sub_category s ON c.sub_category_id = s.sub_category_id
        WHERE cm.company_size is null
        GROUP BY
          j.job_id,
          cm.company_id,
          cm.name,
          cm.short_name,
          cm.industry,
          cm.company_size,
          cm.company_search_url,
          jl.area,
          jl.city,
          jl.country,
          jb.title,
          jb.type,
          m.main_category_id,
          m.name,
          s.sub_category_id,
          s.name,
          jsr.min_salary,
          jsr.max_salary,
          jsr.currency,
          jsr.period,
          jb.status,
          jb.posted_date,
          jb.expiry_date,
          j.content,
          j.share_link`;
    } else {
      query = `SELECT
          j.job_id,
          cm.company_id,
          cm.name AS company_name, 
          cm.short_name,
          cm.industry,
          cm.company_size,
          cm.company_search_url,
          jl.area,
          jl.city,
          jl.country,
          jb.title,
          jb.type,
          m.main_category_id,
          m.name AS main_category_name,
          s.sub_category_id,
          s.name AS sub_category_name,
          jsr.min_salary,
          jsr.max_salary,
          jsr.currency,
          jsr.period,
          jb.status,
          jb.posted_date,
          jb.expiry_date,
          j.content,
          j.share_link,
          (
            SELECT json_agg(js.skill_name)
            FROM jobs_skill js 
            WHERE js.job_id = j.job_id AND js.skill_type = 'soft_skill'
          ) AS soft_skills,
          (
            SELECT json_agg(js.skill_name)
            FROM jobs_skill js 
            WHERE js.job_id = j.job_id AND js.skill_type = 'hard_skill'
          ) AS hard_skills
        FROM jobs j
        INNER JOIN company cm ON j.company_id = cm.company_id
        INNER JOIN location jl ON j.job_id = jl.job_id
        INNER JOIN basicinfo jb ON j.job_id = jb.job_id
        LEFT JOIN salary jsr ON j.job_id = jsr.job_id
        INNER JOIN classification c ON j.job_id = c.job_id
        LEFT JOIN main_category m ON c.main_category_id = m.main_category_id
        LEFT JOIN sub_category s ON c.sub_category_id = s.sub_category_id
        WHERE cm.company_size ILIKE $1
        GROUP BY
          j.job_id,
          cm.company_id,
          cm.name,
          cm.short_name,
          cm.industry,
          cm.company_size,
          cm.company_search_url,
          jl.area,
          jl.city,
          jl.country,
          jb.title,
          jb.type,
          m.main_category_id,
          m.name,
          s.sub_category_id,
          s.name,
          jsr.min_salary,
          jsr.max_salary,
          jsr.currency,
          jsr.period,
          jb.status,
          jb.posted_date,
          jb.expiry_date,
          j.content,
          j.share_link `;
      values = [`%${companySize}%`];
    }

    const result = await database.query(query, values);
    if (result.rows.length == 0) {
      return res
        .status(404)
        .json({ success: false, errormessage: `Data not found` });
    } else {
      let data = [];
      if (companySize) {
        data = result.rows.map((row) => ({
          job_id: row.job_id,
          basicInfo: {
            title: row.title,
            type: row.type,
            status: row.status,
            postedDate: row.posted_date,
            expiryDate: row.expiry_date,
          },
          salary: {
            minSalary: row.min_salary,
            maxSalary: row.max_salary,
            currency: row.currency,
            period: row.period,
          },
          classification: {
            mainCategory: {
              id: row.main_category_id,
              name: row.main_category_name,
            },
            subCategory: {
              id: row.sub_category_id,
              name: row.sub_category_name,
            },
          },
          location: {
            area: row.area,
            city: row.city,
            country: row.country,
          },
          company: {
            id: row.company_id,
            name: row.company_name,
            shortName: row.short_name,
            industry: row.industry,
            size: row.company_size,
            companySearchUrl: row.company_search_url,
          },
          content: row.content,
          extractSkills: {
            hardSkill: row.hard_skills,
            softSkill: row.soft_skills,
          },
          shareLink: row.share_link,
        }));
      } else {
        data = result.rows; // Just return raw data if no status
      }
      const total = result.rows.reduce(
        (sum, row) => sum + parseInt(row.total_jobs || 0, 10),
        0
      );
      if (total) {
        return res.json({
          success: true,
          countObj: result.rows.length,
          total,
          data,
        });
      } else {
        return res.json({
          success: true,
          countObj: result.rows.length,
          data,
        });
      }
    }
  } catch (e) {
    console.error("Error executing jobBycompanySize query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}
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
      return res.status(400).json({
        success: false,
        errormessage:
          "Status type is required: sub_category_id is missing or empty",
      });
    }
    // ถ้าค่าที่ส่งมาไม่ใช่ตัวเลข ให้โยน error
    else if (isNaN(req.query.sub_category_id)) {
      return res.status(400).json({
        success: false,
        errormessage:
          "Status type is required: sub_category_id must be a number",
      });
    } else {
      sub_category_id = parseInt(req.query.sub_category_id, 10);
    }

    const query = `
      WITH JobCounts AS (
          SELECT 
              s.name AS sub_category_name,
              COUNT(jc.job_id)::INTEGER AS total_jobs
          FROM classification jc
          INNER JOIN sub_category s ON jc.sub_category_id = s.sub_category_id
          WHERE ($1::INTEGER IS NULL OR s.sub_category_id = $1::INTEGER)

          GROUP BY s.name
      )
     	SELECT 
          sub_category_name,
          total_jobs
      FROM JobCounts
      ORDER BY total_jobs DESC NULLS LAST;
    `;

    const values = [sub_category_id];

    const result = await database.query(query, values);

    let total = 0;
    for (let i = 0; i < result.rows.length; i++) {
      total  += Number(result.rows[i].total_jobs);
      
    }

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, errormessage: `Data not found` });
    } else {
      return res.json({
        success: true,
        countObj: result.rows.length,
        total: total,
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
  console.log(`GET /jobRatioByType is requested by type=${req.query.type}`);

  try {
    let type; // Full time, Contract/Temp, Contract/Temp, Part time, Casual/Vacation

    // ถ้า req.query เป็น {} (ไม่มีการส่งค่า query มาเลย) ให้กำหนด type เป็น null
    if (Object.keys(req.query).length === 0) {
      type = null;
    }
    // ถ้าส่งค่ามาแต่ไม่ใช่ type หรือเป็นค่าว่าง ให้โยน error
    else if (!req.query.type || req.query.type === "") {
      return res.status(400).json({
        success: false,
        errormessage: "Status type is required: type is missing or empty",
      });
    } else {
      type = req.query.type;
    }

    const query = `
      WITH JobCounts AS (
          SELECT 
              jb.type AS type, 
              -- COUNT(jc.job_id) 
              COUNT(jc.job_id)::INTEGER AS total_jobs
          FROM classification jc
          INNER JOIN sub_category s ON jc.sub_category_id = s.sub_category_id
          INNER JOIN basicinfo jb ON jc.job_id = jb.job_id
          WHERE ($1::VARCHAR  IS NULL OR jb.type ILIKE CONCAT('%', $1::VARCHAR, '%'))  
          GROUP BY jb.type
      )
      SELECT 
          type,
          total_jobs
      FROM JobCounts
      ORDER BY total_jobs DESC NULLS LAST;
    `;

    const values = [type];
    const result = await database.query(query, values);

    let total = 0;
    for (let i = 0; i < result.rows.length; i++) {
      total  += Number(result.rows[i].total_jobs);
      
    }

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, errormessage: `Data not found` });
    } else {
      return res.json({
        success: true,
        countObj: result.rows.length,
        total: total,
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
  console.log(`GET /jobCountByDate is by ${req.params.day} days ago`);

  try {
    const day = req.params.day; // รับค่าจาก params

    // ตรวจสอบว่ามีการส่งค่ามาไหม และค่าเป็นตัวเลข
    if (isNaN(day) || day <= 0) {
      return res.status(400).json({
        success: false,
        errormessage:
          "Invalid day parameter. Please provide a valid positive number.",
      });
    }

    const query = `
      SELECT  COUNT(job_id)::INTEGER AS total_jobs
      FROM basicinfo jb
      WHERE posted_date >= NOW() - INTERVAL '${day} days'
    `;

    const result = await database.query(query);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, errormessage: `Data not found` });
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
  console.log(`GET /jobRatioByLocation is requested by city=${req.query.city}`);

  try {
    let city; // Full time, Contract/Temp, Part time, Casual/Vacation

    // ถ้า req.query เป็น {} (ไม่มีการส่งค่า query มาเลย) ให้กำหนด city เป็น null
    if (Object.keys(req.query).length === 0) {
      city = null;
    }
    // ถ้าส่งค่ามาแต่ไม่ใช่ city หรือเป็นค่าว่าง ให้โยน error
    else if (!req.query.city || req.query.city === "") {
      return res.status(400).json({
        success: false,
        errormessage: "Status city is required: city is missing or empty",
      });
    } else {
      city = req.query.city;
    }
    // WHERE ($1::VARCHAR  IS NULL OR jb.type ILIKE $1::VARCHAR)
    const query = `
      WITH JobCounts AS (
          SELECT
              area AS area,  
              city AS city,  
              country AS country,  
              -- COUNT(job_id) AS total_jobs
              COUNT(job_id)::INTEGER AS total_jobs
          FROM location
          WHERE ($1::VARCHAR  IS NULL OR city ILIKE CONCAT('%', $1::VARCHAR, '%'))
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

    console.log(result.rows)

    let total = 0;
    for (let i = 0; i < result.rows.length; i++) {
      total  += Number(result.rows[i].total_jobs);
      
    }

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, errormessage: `Data not found` });
    } else {
      return res.json({
        success: true,
        countObj: result.rows.length,
        total: total,
        data: result.rows,
      });
    }
  } catch (e) {
    console.error("Error executing jobRatioByLocation query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}


// พีรพล