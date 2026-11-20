CREATE TABLE opportunity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL CHECK (kind IN (
    'submitted', 'under_review', 'approved', 'rejected',
    'delivery_started', 'in_progress', 'testing', 'completed', 'not_started'
  )),
  reason varchar(2000),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX opportunity_history_order_idx
  ON opportunity_history (opportunity_id, created_at ASC, id ASC);

INSERT INTO opportunity_history (opportunity_id, actor_id, kind, created_at)
SELECT id, submitted_by, 'submitted', submitted_at FROM opportunities;

INSERT INTO opportunity_history (opportunity_id, actor_id, kind, created_at)
SELECT a.opportunity_id, a.assessed_by, 'under_review',
  CASE
    WHEN d.decided_at IS NOT NULL AND a.assessed_at >= d.decided_at
      THEN d.decided_at - interval '1 millisecond'
    ELSE a.assessed_at
  END
FROM opportunity_assessments a
LEFT JOIN opportunity_decisions d ON d.opportunity_id = a.opportunity_id;

INSERT INTO opportunity_history (opportunity_id, actor_id, kind, reason, created_at)
SELECT opportunity_id, decided_by, decision, reason, decided_at
FROM opportunity_decisions;

INSERT INTO opportunity_history (opportunity_id, actor_id, kind, created_at)
SELECT opportunity_id, created_by, 'delivery_started', created_at
FROM projects;

INSERT INTO opportunity_history (opportunity_id, actor_id, kind, created_at)
SELECT opportunity_id, created_by, status,
  CASE
    WHEN updated_at <= created_at THEN created_at + interval '1 millisecond'
    ELSE updated_at
  END
FROM projects
WHERE status <> 'not_started';
