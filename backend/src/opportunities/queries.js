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

export async function findOpportunities(pool, { userId, status, category, priority, department, pageSize, offset, sort }) {
  // The ORDER BY fragment comes from the fixed map above. User values are parameters.
  const orderBy = listSortOrders.get(sort);
  const { rows } = await pool.query(
    `WITH matching AS (
       SELECT o.id, o.title, o.department, o.status, o.priority, o.category, o.submitted_at,
              o.submitted_by, submitter.name AS submitter_name
       FROM opportunities o
       JOIN users submitter ON submitter.id = o.submitted_by
       WHERE ($1::uuid IS NULL OR o.submitted_by = $1)
         AND ($2::text IS NULL OR o.status = $2)
         AND ($3::text IS NULL OR o.category = $3)
         AND ($4::text IS NULL OR o.priority = $4)
         AND ($5::text IS NULL OR o.department = $5)
     )
     SELECT counts.total, items.*
     FROM (SELECT count(*) AS total FROM matching) AS counts
     LEFT JOIN (
       SELECT * FROM matching ORDER BY ${orderBy} LIMIT $6 OFFSET $7
     ) AS items ON true
     ORDER BY ${orderBy}`,
    [userId, status, category, priority, department, pageSize, offset]
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
    `SELECT o.*, submitter.name AS submitter_name,
            to_jsonb(a) AS assessment, assessor.name AS assessor_name,
            to_jsonb(d) AS decision, decider.name AS decider_name
     FROM opportunities o
     JOIN users submitter ON submitter.id = o.submitted_by
     LEFT JOIN opportunity_assessments a ON a.opportunity_id = o.id
     LEFT JOIN users assessor ON assessor.id = a.assessed_by
     LEFT JOIN opportunity_decisions d ON d.opportunity_id = o.id
     LEFT JOIN users decider ON decider.id = d.decided_by
     WHERE o.id = $1`,
    [id]
  );

  return rows[0];
}

export async function saveAssessment(pool, id, managerId, data) {
  // Update the opportunity and replace its assessment together in one statement.
  const { rows } = await pool.query(
    `WITH updated AS (
       UPDATE opportunities
       SET priority = $3, category = $4,
           status = CASE WHEN status = 'submitted' THEN 'in_assessment' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *
     ), saved AS (
       INSERT INTO opportunity_assessments (
         opportunity_id, assessed_by, strategic_alignment, benefit_potential,
         complexity, resource_requirements, speed_to_value, notes
       )
       SELECT id, $2, $5, $6, $7, $8, $9, $10 FROM updated
       ON CONFLICT (opportunity_id) DO UPDATE
       SET assessed_by = EXCLUDED.assessed_by,
           strategic_alignment = EXCLUDED.strategic_alignment,
           benefit_potential = EXCLUDED.benefit_potential,
           complexity = EXCLUDED.complexity,
           resource_requirements = EXCLUDED.resource_requirements,
           speed_to_value = EXCLUDED.speed_to_value,
           notes = EXCLUDED.notes,
           assessed_at = CURRENT_TIMESTAMP
       RETURNING *
     )
     SELECT o.*, submitter.name AS submitter_name,
            to_jsonb(a) AS assessment, assessor.name AS assessor_name,
            to_jsonb(d) AS decision, decider.name AS decider_name
     FROM updated o
     JOIN saved a ON a.opportunity_id = o.id
     JOIN users submitter ON submitter.id = o.submitted_by
     JOIN users assessor ON assessor.id = a.assessed_by
     LEFT JOIN opportunity_decisions d ON d.opportunity_id = o.id
     LEFT JOIN users decider ON decider.id = d.decided_by`,
    [
      id, managerId, data.priority, data.category, data.strategicAlignment,
      data.benefitPotential, data.complexity, data.resourceRequirements,
      data.speedToValue, data.notes
    ]
  );

  return rows[0];
}

export async function saveDecision(pool, id, managerId, { decision, reason }) {
  // The status guard makes concurrent or repeated decisions fail without overwriting the first one.
  const { rows } = await pool.query(
    `WITH updated AS (
       UPDATE opportunities
       SET status = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'in_assessment'
       RETURNING *
     ), saved AS (
       INSERT INTO opportunity_decisions (opportunity_id, decided_by, decision, reason)
       SELECT id, $2, $3, $4 FROM updated
       RETURNING *
     )
     SELECT o.*, submitter.name AS submitter_name,
            to_jsonb(a) AS assessment, assessor.name AS assessor_name,
            to_jsonb(d) AS decision, decider.name AS decider_name
     FROM updated o
     JOIN saved d ON d.opportunity_id = o.id
     JOIN users submitter ON submitter.id = o.submitted_by
     JOIN users decider ON decider.id = d.decided_by
     LEFT JOIN opportunity_assessments a ON a.opportunity_id = o.id
     LEFT JOIN users assessor ON assessor.id = a.assessed_by`,
    [id, managerId, decision, reason]
  );

  return rows[0];
}
