export async function listNotifications(pool, userId, status) {
  const { rows } = await pool.query(
    `WITH own AS (
       SELECT n.id, n.opportunity_id, n.kind, n.message, n.created_at, n.read_at
       FROM notifications n JOIN opportunities o ON o.id = n.opportunity_id
       WHERE n.user_id = $1 AND o.submitted_by = $1
     ), matching AS (
       SELECT * FROM own
       WHERE $2 = 'all' OR ($2 = 'unread' AND read_at IS NULL) OR ($2 = 'read' AND read_at IS NOT NULL)
     )
     SELECT counts.unread_count, n.*
     FROM (SELECT count(*)::integer AS unread_count FROM own WHERE read_at IS NULL) counts
     LEFT JOIN matching n ON true
     ORDER BY n.created_at DESC, n.id DESC`,
    [userId, status]
  );
  return { rows: rows.filter((row) => row.id !== null), unreadCount: rows[0].unread_count };
}

export async function markNotificationRead(pool, id, userId) {
  const { rowCount } = await pool.query(
    `UPDATE notifications n
     SET read_at = COALESCE(n.read_at, clock_timestamp())
     FROM opportunities o
     WHERE n.id = $1 AND n.user_id = $2
       AND o.id = n.opportunity_id AND o.submitted_by = $2`,
    [id, userId]
  );
  return rowCount === 1;
}
