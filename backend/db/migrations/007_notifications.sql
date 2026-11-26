CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('approved', 'rejected', 'delivery_started', 'project_completed')),
  message text NOT NULL CHECK (char_length(btrim(message)) > 0),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX notifications_unread_idx
  ON notifications (user_id, created_at DESC, id DESC)
  WHERE read_at IS NULL;
