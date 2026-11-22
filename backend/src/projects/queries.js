const projectFields = `
  p.id, p.opportunity_id, p.status, p.progress, p.created_at, p.updated_at,
  p.start_date::text AS start_date, p.target_date::text AS target_date,
  p.assigned_to AS assignee_id, assignee.name AS assignee_name,
  o.title, o.department, o.priority, o.proposed_improvement AS description
`;
const projectFrom = `
  FROM projects p
  JOIN opportunities o ON o.id = p.opportunity_id
  LEFT JOIN users assignee ON assignee.id = p.assigned_to
`;

export async function listProjects(pool) {
  const { rows } = await pool.query(
    `SELECT ${projectFields}
     ${projectFrom}
     ORDER BY p.created_at DESC, p.id DESC`
  );
  return rows;
}

export async function findProject(pool, id) {
  const { rows } = await pool.query(
    `SELECT ${projectFields}, COALESCE((
       SELECT jsonb_agg(jsonb_build_object(
         'id', n.id, 'text', n.body, 'author', u.name, 'createdAt', n.created_at
       ) ORDER BY n.created_at DESC, n.id DESC)
       FROM project_progress_notes n
       JOIN users u ON u.id = n.author_id
       WHERE n.project_id = p.id
     ), '[]'::jsonb) AS notes
     ${projectFrom}
     WHERE p.id = $1`,
    [id]
  );
  return rows[0];
}

export async function createProject(pool, userId, { opportunityId, startDate, targetDate }) {
  const { rows } = await pool.query(
    `WITH approved AS (
       SELECT id FROM opportunities WHERE id = $1 AND status = 'approved' FOR UPDATE
     ), created AS (
       INSERT INTO projects (opportunity_id, created_by, start_date, target_date)
       SELECT id, $2, $3, $4 FROM approved
       ON CONFLICT (opportunity_id) DO NOTHING
       RETURNING id, opportunity_id, status, created_at
     ), logged AS (
       INSERT INTO opportunity_history (
         opportunity_id, event_type, to_status, actor_id, actor_name, occurred_at
       )
       SELECT p.opportunity_id, 'delivery_started', p.status, u.id, u.name, p.created_at
       FROM created p JOIN users u ON u.id = $2
       RETURNING opportunity_id
     )
     SELECT p.id FROM created p JOIN logged h ON h.opportunity_id = p.opportunity_id`,
    [opportunityId, userId, startDate, targetDate]
  );
  return rows[0]?.id;
}

export async function updateProject(pool, id, authorId, { status, progress, note, startDate, targetDate }) {
  // The status, note and history are atomic. Unchanged statuses add no event.
  const { rowCount } = await pool.query(
    `WITH previous AS (
       SELECT id, status FROM projects WHERE id = $1 FOR UPDATE
     ), updated AS (
       UPDATE projects p
       SET status = COALESCE($2, p.status),
           progress = CASE
             WHEN COALESCE($2, p.status) = 'completed' THEN 100
             ELSE COALESCE($3, p.progress)
           END,
           start_date = COALESCE($6::date, p.start_date),
           target_date = COALESCE($7::date, p.target_date),
           updated_at = clock_timestamp()
       FROM previous WHERE p.id = previous.id
       RETURNING p.id, p.opportunity_id, p.status, previous.status AS previous_status
     ), added_note AS (
       INSERT INTO project_progress_notes (project_id, author_id, body, created_at)
       SELECT id, $4, $5::text, clock_timestamp() FROM updated WHERE $5::text IS NOT NULL
     ), logged AS (
       INSERT INTO opportunity_history (
         opportunity_id, event_type, from_status, to_status, actor_id, actor_name
       )
       SELECT p.opportunity_id, 'delivery_status_changed', p.previous_status, p.status, u.id, u.name
       FROM updated p JOIN users u ON u.id = $4
       WHERE p.previous_status <> p.status
       RETURNING id
     )
     SELECT id FROM updated`,
    [id, status, progress, authorId, note, startDate, targetDate]
  );
  return rowCount === 1;
}

export async function claimProject(pool, id, userId) {
  const { rows } = await pool.query(
    `UPDATE projects
     SET assigned_to = $2, updated_at = clock_timestamp()
     WHERE id = $1 AND (assigned_to IS NULL OR assigned_to = $2)
     RETURNING id`,
    [id, userId]
  );
  if (rows[0]) return 'claimed';
  const existing = await pool.query('SELECT id FROM projects WHERE id = $1', [id]);
  return existing.rows[0] ? 'taken' : 'missing';
}
