import express from 'express';
import { listNotifications, markNotificationRead } from './queries.js';

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function notificationResponse(row) {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    kind: row.kind,
    message: row.message,
    createdAt: row.created_at,
    isRead: row.read_at !== null,
    readAt: row.read_at
  };
}

export function notificationRoutes(pool) {
  const router = express.Router();

  router.get('/notifications', async (req, res) => {
    const status = req.query.status ?? 'unread';
    if (typeof status !== 'string' || !['unread', 'read', 'all'].includes(status)) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR', message: 'Choose a valid notification status.',
        fields: { status: 'Choose unread, read or all.' }
      });
    }
    const result = await listNotifications(pool, req.user.id, status);
    return res.json({ items: result.rows.map(notificationResponse), unreadCount: result.unreadCount });
  });

  router.post('/notifications/:id/read', async (req, res) => {
    const { id } = req.params;
    if (!uuid.test(id) || !await markNotificationRead(pool, id, req.user.id)) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Notification not found.' });
    }
    return res.status(204).end();
  });

  return router;
}
