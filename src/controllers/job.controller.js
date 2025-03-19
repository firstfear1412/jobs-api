import database from "../config/db.config.js";

//ter
export async function searchJob(req, res) {
  console.log(`POST /searchJob is requested`);
  try {
    const {
      search = "",
      location = "",
      main_category = null,
      sub_category = null,
      type = null,
      min_salary = null,
      max_salary = null,
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
          $7::numeric AS max_salary
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
        sa.min_salary,
        sa.max_salary,
        sa.currency,
        sa.period,
        bi.status,
        content,
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
        (
          c.name ILIKE '%' || vars.search || '%'
          OR c.short_name ILIKE '%' || vars.search || '%'
          OR bi.title ILIKE '%' || vars.search || '%'
        )
        AND
        (
          vars.location = '' OR
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
    ];

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
    console.error("Error executing searchJob query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}

//max

//art
export async function fetchJobBySubcatagoryId(req, res) {
  console.log(`GET /fetchJobBySubcatagoryId is requested`);
  console.log(req);

  try {
    const result = await database.query({
      text: `
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
            SELECT json_agg(js.skill_name) -- json_agg(row_to_json(js.skill_name)) 
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
        LEFT JOIN jobs_skill jsk ON j.job_id = jsk.job_id

        WHERE s.sub_category_id = $1

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
      `,
      values: [req.params.sub_category_id]
    });
    
    if (result.rowCount == 0) {
      return res.status(404).json({ success: false, errormessage: `Data not found` });
    } else {
      let data = []
      for (let i = 0; i < result.rows.length; i++) {
        data.push({
          "job_id": result.rows[i]['job_id'],
          "basicInfo": {
            "title": result.rows[i]['title'],
            "type": result.rows[i]['type'],
            "status": result.rows[i]['status'],
            "postedDate": result.rows[i]['posted_date'],
            "expiryDate": result.rows[i]['expiry_date']
          },
          "salary": {
            "minSalary": result.rows[i]['min_salary'],
            "maxSalary": result.rows[i]['max_salary'],
            "currency": result.rows[i]['currency'],
            "period": result.rows[i]['period']
          },
          "classification": {
            "mainCategory": {
              "id" : result.rows[i]['main_category_id'],
              "name"  : result.rows[i]['main_category_name']
            },
            "subCategory": {
              "id" : result.rows[i]['sub_category_id'],
              "name"  : result.rows[i]['sub_category_name']
            }
          },
          "location": {
            "area": result.rows[i]['area'],
            "city": result.rows[i]['city'],
            "country": result.rows[i]['country']
          },
          "company": {
            "id": result.rows[i]['company_id'],
            "name": result.rows[i]['company_name'],
            "shortName":result.rows[i]['short_name'],
            "industry": result.rows[i]['industry'],
            "size": result.rows[i]['company_size']
          },
          "content" : result.rows[i]['content'],
          "extractSkills" : {
            "hardSkills" : result.rows[i]['hard_skills'],
            "softSkills" : result.rows[i]['soft_skills']
          },
        })
      }
      
      return res.json({
        success: true,
        count: result.rows.length,
        data
      });
    }
  } catch (e) {
    console.error("Error executing searchJob query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}



export async function fetchJobByDateRange(req, res) {
  console.log(`POST /fetchJobByDateRange is requested`);
  // const bodyData = req.body;
  const {
    start,
    end
  } = req.body;
  try {

    console.log(start);
    console.log(end);

    return res.json({
      success: true,
      start,
      end
    });
    
  } catch (e) {
    console.error("Error executing searchJob query", e);
    return res.status(500).json({ success: false, errormessage: e.message });
  }
}