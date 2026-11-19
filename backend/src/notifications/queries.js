const messages = {
  under_review: (title) => `Your opportunity “${title}” is now Under Review.`,
  approved: (title) => `Your opportunity “${title}” was approved.`,
  rejected: (title) => `Your opportunity “${title}” was rejected.`,
  delivery_started: (title) => `Your opportunity “${title}” moved to project delivery.`,
  in_progress: (title) => `Your opportunity “${title}” is now In Progress.`,
  testing: (title) => `Your opportunity “${title}” is now Testing.`,
  project_completed: (title) => `Your opportunity “${title}” is now Completed.`
};

const kindForStatus = {
  in_assessment: 'under_review',
  approved: 'approved',
  rejected: 'rejected',
  in_progress: 'in_progress',
  testing: 'testing',
  completed: 'project_completed'
};

export function visibleStatus(opportunityStatus, deliveryStatus) {
  if (opportunityStatus === 'approved' && deliveryStatus && deliveryStatus !== 'not_started') return deliveryStatus;
  return opportunityStatus;
}

export async function notifyStatusChange(pool, { opportunityId, actorId, from, to }) {
  const kind = from !== to ? kindForStatus[to] : undefined;
  if (!kind) return;
  const message = to === 'approved' && from !== 'in_assessment'
    ? (title) => `Your opportunity “${title}” is now Approved.`
    : undefined;
  await notifySubmitter(pool, { opportunityId, actorId, kind, message });
}

export async function notifySubmitter(pool, { opportunityId, actorId, kind, message }) {
  const { rows } = await pool.query(
    'SELECT submitted_by, title FROM opportunities WHERE id = $1',
    [opportunityId]
  );
  const opportunity = rows[0];
  const text = opportunity && (message ?? messages[kind])?.(opportunity.title);
  if (!opportunity || opportunity.submitted_by === actorId || !text) return;

  await pool.query(
    `INSERT INTO notifications (user_id, opportunity_id, kind, message)
     VALUES ($1, $2, $3, $4)`,
    [opportunity.submitted_by, opportunityId, kind, text]
  );
}

export async function listUnreadNotifications(pool, userId) {
  const { rows } = await pool.query(
    `SELECT id, opportunity_id, kind, message, created_at
     FROM notifications
     WHERE user_id = $1 AND read_at IS NULL
     ORDER BY created_at DESC, id DESC`,
    [userId]
  );
  return rows;
}

export async function markNotificationRead(pool, id, userId) {
  const { rowCount } = await pool.query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rowCount === 1;
}
