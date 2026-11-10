const projectFields = `
  p.id, p.opportunity_id, p.status, p.progress, p.created_at, p.updated_at,
  p.start_date::text AS start_date, p.target_date::text AS target_date,
  o.title, o.department, o.priority, o.proposed_improvement AS description
`;

export async function listProjects(pool) {
  const { rows } = await pool.query(
    `SELECT ${projectFields}
     FROM projects p
     JOIN opportunities o ON o.id = p.opportunity_id
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
     FROM projects p
     JOIN opportunities o ON o.id = p.opportunity_id
     WHERE p.id = $1`,
    [id]
  );
  return rows[0];
}

export async function createProject(pool, userId, { opportunityId, startDate, targetDate }) {
  const { rows } = await pool.query(
    `WITH approved AS (
       SELECT id FROM opportunities WHERE id = $1 AND status = 'approved' FOR UPDATE
     )
     INSERT INTO projects (opportunity_id, created_by, start_date, target_date)
     SELECT id, $2, $3, $4 FROM approved
     ON CONFLICT (opportunity_id) DO NOTHING
     RETURNING id`,
    [opportunityId, userId, startDate, targetDate]
  );
  return rows[0]?.id;
}

export async function updateProject(pool, id, authorId, { status, progress, note }) {
  // The status and its note are committed together. A note-only request leaves other fields intact.
  const { rowCount } = await pool.query(
    `WITH updated AS (
       UPDATE projects
       SET status = COALESCE($2, status),
           progress = CASE
             WHEN COALESCE($2, status) = 'completed' THEN 100
             ELSE COALESCE($3, progress)
           END,
           updated_at = clock_timestamp()
       WHERE id = $1
       RETURNING id
     ), added_note AS (
       INSERT INTO project_progress_notes (project_id, author_id, body, created_at)
       SELECT id, $4, $5::text, clock_timestamp() FROM updated WHERE $5::text IS NOT NULL
     )
     SELECT id FROM updated`,
    [id, status, progress, authorId, note]
  );
  return rowCount === 1;
}
