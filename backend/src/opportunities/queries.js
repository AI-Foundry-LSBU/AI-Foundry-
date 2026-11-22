import { lsbuContextVersion } from '../benefits/university.js';

export async function insertOpportunity(pool, userId, data) {
  const { rows } = await pool.query(
    `WITH created AS (
       INSERT INTO opportunities (
         submitted_by, title, department, problem_description, proposed_improvement,
         expected_benefits, source, hackathon_name
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *
     ), logged AS (
       INSERT INTO opportunity_history (
         opportunity_id, event_type, to_status, actor_id, actor_name, occurred_at
       )
       SELECT o.id, 'submitted', o.status, u.id, u.name, o.submitted_at
       FROM created o JOIN users u ON u.id = $1
       RETURNING opportunity_id
     )
     SELECT o.* FROM created o JOIN logged h ON h.opportunity_id = o.id`,
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

export async function findOpportunities(pool, { userId, engineerId, status, category, priority, department, pageSize, offset, sort }) {
  // The ORDER BY fragment comes from the fixed map above. User values are parameters.
  const orderBy = listSortOrders.get(sort);
  const { rows } = await pool.query(
    `WITH matching AS (
       SELECT o.id, o.title, o.department, o.status, o.priority, o.category, o.submitted_at,
              o.submitted_by, submitter.name AS submitter_name, p.id AS project_id,
              p.status AS delivery_status, assignee.id AS assignee_id, assignee.name AS assignee_name
       FROM opportunities o
       JOIN users submitter ON submitter.id = o.submitted_by
       LEFT JOIN projects p ON p.opportunity_id = o.id
       LEFT JOIN users assignee ON assignee.id = p.assigned_to
       WHERE ($1::uuid IS NULL OR o.submitted_by = $1)
         AND ($2::text IS NULL OR o.status = $2)
         AND ($3::text IS NULL OR o.category = $3)
         AND ($4::text IS NULL OR o.priority = $4)
         AND ($5::text IS NULL OR o.department = $5)
         AND ($8::uuid IS NULL OR o.status = 'approved' OR o.submitted_by = $8)
     )
     SELECT counts.total, items.*
     FROM (SELECT count(*) AS total FROM matching) AS counts
     LEFT JOIN (
       SELECT * FROM matching ORDER BY ${orderBy} LIMIT $6 OFFSET $7
     ) AS items ON true
     ORDER BY ${orderBy}`,
    [userId, status, category, priority, department, pageSize, offset, engineerId]
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
            to_jsonb(d) AS decision, decider.name AS decider_name,
            p.id AS project_id, p.status AS delivery_status,
            assignee.id AS assignee_id, assignee.name AS assignee_name,
            r.recommendation AS review_recommendation, r.summary AS review_summary,
            r.reason AS review_reason, r.similar_title AS review_similar_title,
            r.potential_benefits AS review_benefits, r.assessment AS review_assessment,
            r.context_version AS review_context_version
     FROM opportunities o
     JOIN users submitter ON submitter.id = o.submitted_by
     LEFT JOIN opportunity_assessments a ON a.opportunity_id = o.id
     LEFT JOIN users assessor ON assessor.id = a.assessed_by
     LEFT JOIN opportunity_decisions d ON d.opportunity_id = o.id
     LEFT JOIN users decider ON decider.id = d.decided_by
     LEFT JOIN projects p ON p.opportunity_id = o.id
     LEFT JOIN users assignee ON assignee.id = p.assigned_to
     LEFT JOIN opportunity_benefit_reviews r ON r.opportunity_id = o.id
     WHERE o.id = $1`,
    [id]
  );

  return rows[0];
}

export async function findOpportunityHistory(pool, id) {
  // One snapshot distinguishes a missing opportunity from an empty timeline.
  const { rows } = await pool.query(
    `SELECT o.id AS requested_opportunity_id, h.*
     FROM opportunities o
     LEFT JOIN opportunity_history h ON h.opportunity_id = o.id
     WHERE o.id = $1
     ORDER BY h.occurred_at ASC, h.id ASC`,
    [id]
  );
  if (!rows.length) return undefined;
  return { opportunityId: rows[0].requested_opportunity_id, rows: rows.filter((row) => row.id !== null) };
}

export async function saveAssessment(pool, id, managerId, data) {
  // Lock the old status, then save the assessment and any transition together.
  const { rows } = await pool.query(
    `WITH previous AS (
       SELECT id, status FROM opportunities WHERE id = $1 FOR UPDATE
     ), updated AS (
       UPDATE opportunities o
       SET priority = $3, category = $4,
           status = CASE WHEN o.status = 'submitted' THEN 'in_assessment' ELSE o.status END,
           updated_at = CURRENT_TIMESTAMP
       FROM previous WHERE o.id = previous.id
       RETURNING o.*, previous.status AS previous_status
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
     ), logged AS (
       INSERT INTO opportunity_history (
         opportunity_id, event_type, from_status, to_status, actor_id, actor_name
       )
       SELECT o.id, 'status_changed', previous.status, o.status, u.id, u.name
       FROM updated o JOIN previous ON previous.id = o.id
       JOIN users u ON u.id = $2
       WHERE previous.status <> o.status
       RETURNING id
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
    `WITH previous AS (
       SELECT id, status FROM opportunities
       WHERE id = $1 AND status = 'in_assessment' FOR UPDATE
     ), updated AS (
       UPDATE opportunities o
       SET status = $3, updated_at = CURRENT_TIMESTAMP
       FROM previous WHERE o.id = previous.id AND o.status = 'in_assessment'
       RETURNING o.*
     ), saved AS (
       INSERT INTO opportunity_decisions (opportunity_id, decided_by, decision, reason)
       SELECT id, $2, $3, $4 FROM updated
       RETURNING *
     ), logged AS (
       INSERT INTO opportunity_history (
         opportunity_id, event_type, from_status, to_status, actor_id, actor_name, reason, occurred_at
       )
       SELECT o.id, 'decision_recorded', previous.status, d.decision,
              u.id, u.name, d.reason, d.decided_at
       FROM updated o JOIN previous ON previous.id = o.id
       JOIN saved d ON d.opportunity_id = o.id
       JOIN users u ON u.id = d.decided_by
       RETURNING opportunity_id
     ), project_created AS (
       INSERT INTO projects (opportunity_id, created_by)
       SELECT o.id, $2 FROM updated o
       WHERE $3 = 'approved'
       ON CONFLICT (opportunity_id) DO NOTHING
       RETURNING opportunity_id, status, created_at
     ), delivery_logged AS (
       INSERT INTO opportunity_history (
         opportunity_id, event_type, to_status, actor_id, actor_name, occurred_at
       )
       SELECT p.opportunity_id, 'delivery_started', p.status, u.id, u.name, p.created_at
       FROM project_created p
       JOIN logged l ON l.opportunity_id = p.opportunity_id
       JOIN users u ON u.id = $2
       RETURNING opportunity_id
     )
     SELECT o.*, submitter.name AS submitter_name,
            p.id AS project_id, p.status AS delivery_status,
            to_jsonb(a) AS assessment, assessor.name AS assessor_name,
            to_jsonb(d) AS decision, decider.name AS decider_name
     FROM updated o
     JOIN saved d ON d.opportunity_id = o.id
     JOIN users submitter ON submitter.id = o.submitted_by
     JOIN users decider ON decider.id = d.decided_by
     LEFT JOIN opportunity_assessments a ON a.opportunity_id = o.id
     LEFT JOIN users assessor ON assessor.id = a.assessed_by
     LEFT JOIN projects p ON p.opportunity_id = o.id
     LEFT JOIN delivery_logged dl ON dl.opportunity_id = o.id`,
    [id, managerId, decision, reason]
  );

  return rows[0];
}

export async function benefitReviewContext(pool, opportunityId) {
  const opportunities = await pool.query(
    `SELECT title FROM opportunities WHERE id <> $1 ORDER BY submitted_at DESC LIMIT 12`,
    [opportunityId]
  );
  const benefits = await pool.query(
    `SELECT description FROM project_benefits ORDER BY recorded_on DESC, id DESC LIMIT 12`
  );
  return {
    existingOpportunityTitles: opportunities.rows.map((row) => row.title),
    existingBenefitDescriptions: benefits.rows.map((row) => row.description)
  };
}

export async function saveBenefitReview(pool, opportunityId, review) {
  await pool.query(
    `INSERT INTO opportunity_benefit_reviews
       (opportunity_id, recommendation, summary, reason, similar_title, potential_benefits, assessment, context_version)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
     ON CONFLICT (opportunity_id) DO UPDATE
     SET recommendation = EXCLUDED.recommendation,
         summary = EXCLUDED.summary,
         reason = EXCLUDED.reason,
         similar_title = EXCLUDED.similar_title,
         potential_benefits = EXCLUDED.potential_benefits,
         assessment = COALESCE(opportunity_benefit_reviews.assessment, EXCLUDED.assessment),
         context_version = EXCLUDED.context_version
     WHERE opportunity_benefit_reviews.context_version < EXCLUDED.context_version`,
    [
      opportunityId, review.recommendation, review.summary, review.reason, review.similarTitle,
      JSON.stringify(review.benefits ?? []),
      review.assessment ? JSON.stringify(review.assessment) : null,
      lsbuContextVersion
    ]
  );
}

export async function saveReviewAssessment(pool, opportunityId, assessment) {
  await pool.query(
    `UPDATE opportunity_benefit_reviews
     SET assessment = $2::jsonb
     WHERE opportunity_id = $1 AND assessment IS NULL`,
    [opportunityId, JSON.stringify(assessment)]
  );
}

export async function listBenefitReviews(pool) {
  const { rows } = await pool.query(
    `SELECT o.id, o.title, o.department, r.recommendation, r.summary, r.reason,
            r.similar_title, r.potential_benefits
     FROM opportunity_benefit_reviews r
     JOIN opportunities o ON o.id = r.opportunity_id
     ORDER BY r.created_at DESC, o.id DESC`
  );
  return rows;
}
