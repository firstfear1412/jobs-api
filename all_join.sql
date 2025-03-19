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
	m.name AS main_category_name,
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
	
    COALESCE(
        '[' || STRING_AGG(
            CASE 
                WHEN jsk.skill_type = 'hard_skill' THEN '"' || jsk.skill_name || '"'
            END, 
            ', '
        ) || ']', '[]'
    ) AS hard_skill,
    
    COALESCE(
        '[' || STRING_AGG(
            CASE 
                WHEN jsk.skill_type = 'soft_skill' THEN '"' || jsk.skill_name || '"'
            END, 
            ', '
        ) || ']', '[]'
    ) AS soft_skill
FROM jobs j
INNER JOIN company cm ON j.company_id = cm.company_id
INNER JOIN location jl ON j.job_id = jl.job_id
INNER JOIN basicinfo jb ON j.job_id = jb.job_id
INNER JOIN salary jsr ON j.job_id = jsr.job_id
INNER JOIN classification c ON j.job_id = c.job_id
INNER JOIN main_category m ON c.main_category_id = m.main_category_id
INNER JOIN sub_category s ON c.sub_category_id = s.sub_category_id
LEFT JOIN jobs_skill jsk ON j.job_id = jsk.job_id

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
	m.name,
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
;

-- "Contract/Temp"
-- "Part time"
-- "Full time"
-- "Casual/Vacation"
