ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (
  kind IN (
    'under_review',
    'approved',
    'rejected',
    'delivery_started',
    'in_progress',
    'testing',
    'project_completed'
  )
);
