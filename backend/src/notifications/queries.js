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
