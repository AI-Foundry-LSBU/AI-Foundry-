CREATE TABLE opportunity_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'submitted', 'status_changed', 'decision_recorded',
    'delivery_started', 'delivery_status_changed'
  )),
  from_status text,
  to_status text NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  actor_name text NOT NULL CHECK (char_length(btrim(actor_name)) > 0),
  reason varchar(2000),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  source text NOT NULL DEFAULT 'live' CHECK (source IN ('live', 'backfill')),
  CHECK (
    (event_type IN ('submitted', 'status_changed', 'decision_recorded')
      AND to_status IN ('submitted', 'in_assessment', 'approved', 'rejected', 'in_progress', 'completed')
      AND (from_status IS NULL OR from_status IN ('submitted', 'in_assessment', 'approved', 'rejected', 'in_progress', 'completed')))
    OR
    (event_type IN ('delivery_started', 'delivery_status_changed')
      AND to_status IN ('not_started', 'in_progress', 'testing', 'completed')
      AND (from_status IS NULL OR from_status IN ('not_started', 'in_progress', 'testing', 'completed')))
  ),
  CHECK (event_type <> 'submitted' OR (from_status IS NULL AND to_status = 'submitted')),
  CHECK (event_type <> 'delivery_started' OR (from_status IS NULL AND to_status = 'not_started')),
  CHECK (event_type NOT IN ('status_changed', 'delivery_status_changed')
    OR (from_status IS NOT NULL AND from_status <> to_status)),
  CHECK (event_type <> 'decision_recorded' OR to_status IN ('approved', 'rejected')),
  CHECK (event_type = 'decision_recorded' OR reason IS NULL),
  CHECK (event_type <> 'decision_recorded' OR to_status <> 'rejected'
    OR COALESCE(char_length(btrim(reason)), 0) > 0)
);

CREATE INDEX opportunity_history_timeline_idx
  ON opportunity_history (opportunity_id, occurred_at, id);

-- Recover only facts still stored by the old system. Earlier assessment and
-- delivery transitions were overwritten and cannot be reconstructed reliably.
INSERT INTO opportunity_history (
  opportunity_id, event_type, to_status, actor_id, actor_name, occurred_at, source
)
SELECT o.id, 'submitted', 'submitted', u.id, u.name, o.submitted_at, 'backfill'
FROM opportunities o JOIN users u ON u.id = o.submitted_by;

INSERT INTO opportunity_history (
  opportunity_id, event_type, to_status, actor_id, actor_name, reason, occurred_at, source
)
SELECT d.opportunity_id, 'decision_recorded', d.decision, u.id, u.name,
       d.reason, d.decided_at, 'backfill'
FROM opportunity_decisions d JOIN users u ON u.id = d.decided_by;

-- History has no edit/delete API. Also reject direct row changes, while keeping
-- the existing staff deletion workflow: deleting its opportunity cascades here.
CREATE FUNCTION protect_opportunity_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM opportunities WHERE id = OLD.opportunity_id
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Opportunity history entries cannot be changed.' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER opportunity_history_read_only
BEFORE UPDATE OR DELETE ON opportunity_history
FOR EACH ROW EXECUTE FUNCTION protect_opportunity_history();
