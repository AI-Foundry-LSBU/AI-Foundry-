const benefitSelect = `
  SELECT b.*, b.recorded_on::text AS date, o.title AS project_title
  FROM project_benefits b
  JOIN projects p ON p.id = b.project_id
  JOIN opportunities o ON o.id = p.opportunity_id
`;

export async function listBenefits(pool, projectId) {
  const { rows } = await pool.query(
    `${benefitSelect}
     WHERE ($1::uuid IS NULL OR b.project_id = $1)
     ORDER BY b.recorded_on DESC, b.created_at DESC, b.id DESC`,
    [projectId]
  );
  return rows;
}

export async function findBenefit(pool, id) {
  const { rows } = await pool.query(`${benefitSelect} WHERE b.id = $1`, [id]);
  return rows[0];
}

export async function insertBenefit(pool, userId, data) {
  const { rows } = await pool.query(
    `INSERT INTO project_benefits (
       project_id, category, description, measurement, estimated, actual,
       unit, recorded_on, notes, created_by, updated_by
     )
     SELECT id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10
     FROM projects WHERE id = $1
     RETURNING id`,
    [
      data.projectId, data.category, data.description, data.measurement,
      data.estimated, data.actual, data.unit, data.date, data.notes || null, userId
    ]
  );
  return rows[0]?.id;
}

export async function replaceBenefit(pool, id, userId, data) {
  const { rowCount } = await pool.query(
    `UPDATE project_benefits b
     SET project_id = p.id, category = $3, description = $4, measurement = $5,
         estimated = $6, actual = $7, unit = $8, recorded_on = $9, notes = $10,
         updated_by = $11, updated_at = clock_timestamp()
     FROM projects p
     WHERE b.id = $1 AND p.id = $2
     RETURNING b.id`,
    [
      id, data.projectId, data.category, data.description, data.measurement,
      data.estimated, data.actual, data.unit, data.date, data.notes || null, userId
    ]
  );
  return rowCount === 1;
}
