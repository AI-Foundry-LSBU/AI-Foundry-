import express from 'express';
import { listUnreadNotifications, markNotificationRead } from './queries.js';

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function notificationResponse(row) {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    kind: row.kind,
    message: row.message,
    createdAt: row.created_at
  };
}

export function notificationRoutes(pool) {
  const router = express.Router();

  router.get('/notifications', async (req, res) => {
    const rows = await listUnreadNotifications(pool, req.user.id);
    res.json({ items: rows.map(notificationResponse) });
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
