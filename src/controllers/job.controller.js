import database from "../config/db.config.js";

//ter
export async function searchJob(req, res) {
  console.log(`POST /searchJob is requested`);
  try {
    const {
      search = null,
      location = null,
      main_category = null,
      sub_category = null,
      type = null,
      min_salary = null,
      max_salary = null,
      day = null,
    } = req.body;
    //#region query
    const query = `
      WITH vars AS (
        SELECT 
          $1::text AS search,
          $2::text AS location,
          $3::text AS main_category,
          $4::text AS sub_category,
          $5::text AS type,
          $6::numeric AS min_salary,
          $7::numeric AS max_salary,
		      $8::int AS day
      )
      SELECT j.job_id, 
        j.company_id,
        c.name AS company_name,
        c.short_name AS short_name,
        c.industry,
        c.company_size AS company_size,
        lo.city,
        lo.area,
        bi.title,
        bi.posted_date,
        bi.type,
        csf.main_category AS main_category,
        csf.sub_category AS sub_category,
        sa.min_salary::FLOAT,
        sa.max_salary::FLOAT,
        sa.currency,
        sa.period,
        bi.status,
        content,
        (
          SELECT json_agg(js.skill_name)
          FROM jobs_skill js 
          WHERE js.job_id = j.job_id AND js.skill_type = 'soft_skill'
        ) AS soft_skills,
        (
          SELECT json_agg(js.skill_name)
          FROM jobs_skill js 
          WHERE js.job_id = j.job_id AND js.skill_type = 'hard_skill'
        ) AS hard_skills,
        CASE
          WHEN c.short_name ILIKE '%' || vars.search || '%' THEN 1
          WHEN c.name ILIKE '%' || vars.search || '%' THEN 2
          WHEN bi.title ILIKE '%' || vars.search || '%' THEN 3
          ELSE 4
        END AS rank_search,
        CASE
          WHEN lo.area ILIKE '%' || vars.location || '%' THEN 1
          WHEN lo.city ILIKE '%' || vars.location || '%' THEN 2
          ELSE 3
        END AS rank_location
        
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
        SELECT *
        FROM "salary"
        WHERE has_salary_info = 1
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
          (vars.search IS NULL OR 
              (
                c.name ILIKE '%' || vars.search || '%'
                OR c.short_name ILIKE '%' || vars.search || '%'
                OR bi.title ILIKE '%' || vars.search || '%'
              )
        )
        AND
        (
          vars.location IS NULL OR
          (
            (lo.area IS NOT NULL AND lo.area ILIKE '%' || vars.location || '%')
            OR (lo.city IS NOT NULL AND lo.city ILIKE '%' || vars.location || '%')
          )
        )
        AND (vars.type IS NULL OR bi.type ILIKE '%' || vars.type || '%')
        AND
        (
          CASE 
                WHEN vars.min_salary IS NULL AND vars.max_salary IS NULL THEN 1
                ELSE 
                    CASE 
                        WHEN sa.has_salary_info = 1
                        AND sa.min_salary IS NOT NULL AND sa.min_salary <> 0
                        AND sa.max_salary IS NOT NULL AND sa.max_salary <> 0
                        AND 
                        ( 
                            sa.min_salary <= COALESCE(vars.max_salary, sa.min_salary) 
                            AND 
                            sa.max_salary >= COALESCE(vars.min_salary, sa.max_salary)
                        ) 
                        THEN 1
                        ELSE 0
                    END
            END = 1
        )
        AND (vars.main_category IS NULL OR (csf.main_category IS NOT NULL AND csf.main_category ILIKE '%' || vars.main_category || '%'))
        AND (vars.sub_category IS NULL OR (csf.sub_category IS NOT NULL AND csf.sub_category ILIKE '%' || vars.sub_category || '%'))
        AND (vars.day IS NULL OR (bi.posted_date >= CURRENT_DATE - INTERVAL '1 day' * vars.day))
      ORDER BY rank_search, rank_location, bi.posted_date DESC, c.short_name, c.name
    `;
    //#endregion query

    const values = [
      search,
      location,
      main_category,
      sub_category,
      type,
      min_salary,
      max_salary,
      day,
    ];

    const result = await database.query(query, values);
    if (result.rowsCount == 0) {
      return res
        .status(404)
        .json({ success: false, errormessage: `Data not found` });
    } else {
      const data = result.rows.map((row) => ({
        job_id: row.job_id,
        company: {
          id: row.company_id,
          name: row.company_name,
          shortName: row.short_name,
          industry: row.industry,
          size: row.company_size,
        },
        location: {
          area: row.area,
          city: row.city,
        },
        basicInfo: {
          title: row.title,
          type: row.type,
          postedDate: row.posted_date,
        },
        classification: {
          mainCategory: row.main_category,
          subCategory: row.sub_category,
        },
        salary: {
          minSalary: row.min_salary,
          maxSalary: row.max_salary,
          currency: row.currency,
          period: row.period,
        },
        status: row.status,
        content: row.content,
        skill: {
          hardSkill: row.hard_skills,
          softSkill: row.soft_skills,
        },
        rankSearch: row.rank_search,
        rankLocation: row.rank_location,
      }));
      return res.json({
        success: true,
        count: result.rows.length,
        data: data,
      });
    }
  } catch (e) {
    console.error("Error executing searchJob query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}
