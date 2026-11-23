-- Extend the existing notification store; do not replace or mark old messages read.
-- Older notifications have no reliable one-to-one event link, so it stays nullable.
ALTER TABLE notifications
  ADD COLUMN history_event_id bigint UNIQUE
    REFERENCES opportunity_history(id) ON DELETE CASCADE;

-- The existing partial index serves unread queries. This also serves read/all views.
CREATE INDEX notifications_user_created_idx
  ON notifications (user_id, created_at DESC, id DESC);
