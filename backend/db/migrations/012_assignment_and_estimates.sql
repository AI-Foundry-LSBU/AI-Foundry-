ALTER TABLE projects
  ADD COLUMN assigned_to uuid REFERENCES users(id);

ALTER TABLE opportunity_benefit_reviews
  ADD COLUMN potential_benefits jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Approved opportunities created after the first backfill still need a delivery project.
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
