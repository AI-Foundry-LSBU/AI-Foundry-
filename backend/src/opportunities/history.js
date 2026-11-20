export const historySummaries = {
  submitted: 'Opportunity submitted.',
  under_review: 'Status changed to Under Review.',
  approved: 'Opportunity approved.',
  rejected: 'Opportunity rejected.',
  delivery_started: 'Moved to project delivery.',
  in_progress: 'Status changed to In Progress.',
  testing: 'Status changed to Testing.',
  completed: 'Status changed to Completed.',
  not_started: 'Status changed to Approved.'
};

export async function recordHistory(pool, { opportunityId, actorId, kind, reason }) {
  if (!historySummaries[kind]) return;
  const text = typeof reason === 'string' && reason.trim() ? reason.trim() : null;
  await pool.query(
    `INSERT INTO opportunity_history (opportunity_id, actor_id, kind, reason)
     VALUES ($1, $2, $3, $4)`,
    [opportunityId, actorId, kind, text]
  );
}

export async function listHistory(pool, opportunityId) {
  const { rows } = await pool.query(
    `SELECT h.id, h.kind, h.reason, h.created_at, u.id AS actor_id, u.name AS actor_name
     FROM opportunity_history h
     JOIN users u ON u.id = h.actor_id
     WHERE h.opportunity_id = $1
     ORDER BY h.created_at ASC, h.id ASC`,
    [opportunityId]
  );
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    summary: historySummaries[row.kind],
    reason: row.reason ?? undefined,
    actor: { id: row.actor_id, name: row.actor_name },
    createdAt: row.created_at
  }));
}
