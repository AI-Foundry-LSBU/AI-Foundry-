export async function insertOpportunity(pool, userId, data) {
  const { rows } = await pool.query(
    `INSERT INTO opportunities (
       submitted_by, title, department, problem_description, proposed_improvement,
       expected_benefits, source, hackathon_name
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId, data.title, data.department, data.problemDescription, data.proposedImprovement,
      data.expectedBenefits, data.source, data.hackathonName
    ]
  );

  return rows[0];
}

const priorityRank = "CASE priority WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 END";

export const listSortOrders = new Map([
  ['submittedAt', 'submitted_at ASC, id ASC'],
  ['-submittedAt', 'submitted_at DESC, id DESC'],
  ['priority', `${priorityRank} ASC NULLS LAST, submitted_at DESC, id DESC`],
  ['-priority', `${priorityRank} DESC NULLS LAST, submitted_at DESC, id DESC`]
]);

export async function findUserOpportunities(pool, userId, { pageSize, offset, sort }) {
  // The ORDER BY fragment comes from the fixed map above. User values are parameters.
  const orderBy = listSortOrders.get(sort);
  const { rows } = await pool.query(
    `SELECT counts.total, items.*
     FROM (SELECT count(*) AS total FROM opportunities WHERE submitted_by = $1) AS counts
     LEFT JOIN (
       SELECT id, title, department, status, priority, category, submitted_at
       FROM opportunities
       WHERE submitted_by = $1
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3
     ) AS items ON true
     ORDER BY ${orderBy}`,
    [userId, pageSize, offset]
  );

  // The count survives even when a page has no items.
  return { rows: rows.filter((row) => row.id !== null), total: Number(rows[0].total) };
}

export async function deleteOpportunity(pool, id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM opportunities WHERE id = $1 AND submitted_by = $2',
    [id, userId]
  );
  return rowCount === 1;
}

export async function findOpportunity(pool, id) {
  const { rows } = await pool.query(
    `SELECT opportunities.*, users.name AS submitter_name
     FROM opportunities
     JOIN users ON users.id = opportunities.submitted_by
     WHERE opportunities.id = $1`,
    [id]
  );

  return rows[0];
}
