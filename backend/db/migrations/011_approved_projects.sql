CREATE TABLE opportunity_benefit_reviews (
  opportunity_id uuid PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
  recommendation text NOT NULL CHECK (recommendation IN ('worth_pursuing', 'not_worth_it')),
  summary text NOT NULL CHECK (char_length(btrim(summary)) BETWEEN 1 AND 1200),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 1200),
  similar_title text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- An approved opportunity is a delivery project that has not started.
INSERT INTO projects (opportunity_id, created_by)
SELECT o.id, COALESCE(d.decided_by, o.submitted_by)
FROM opportunities o
LEFT JOIN opportunity_decisions d ON d.opportunity_id = o.id
WHERE o.status = 'approved'
  AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.opportunity_id = o.id);

INSERT INTO opportunity_history (
  opportunity_id, event_type, to_status, actor_id, actor_name, occurred_at, source
)
SELECT p.opportunity_id, 'delivery_started', 'not_started', u.id, u.name, p.created_at, 'backfill'
FROM projects p
JOIN users u ON u.id = p.created_by
WHERE NOT EXISTS (
  SELECT 1 FROM opportunity_history h
  WHERE h.opportunity_id = p.opportunity_id AND h.event_type = 'delivery_started'
);
