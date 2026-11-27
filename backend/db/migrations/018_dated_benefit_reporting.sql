-- A missing measurement is not a recorded zero. Existing numbers are retained.
ALTER TABLE project_benefits
  ALTER COLUMN estimated DROP NOT NULL,
  ALTER COLUMN actual DROP NOT NULL,
  ADD COLUMN recurrence text NOT NULL DEFAULT 'unspecified'
    CHECK (recurrence IN ('unspecified', 'one_off', 'monthly', 'yearly')),
  ADD COLUMN recurs_until date,
  ADD CONSTRAINT project_benefits_recurrence_dates_check CHECK (
    (recurrence IN ('unspecified', 'one_off') AND recurs_until IS NULL)
    OR (recurrence IN ('monthly', 'yearly') AND recurs_until IS NOT NULL AND recurs_until >= recorded_on)
  ),
  ADD CONSTRAINT project_benefits_recurrence_unit_check CHECK (
    recurrence IN ('unspecified', 'one_off')
    OR (recurrence = 'monthly' AND unit IN ('Hours/month', 'Cases/month'))
    OR (recurrence = 'yearly' AND unit = 'GBP/year')
  );

-- updated_at can change after completion when dates, assignment or notes change.
-- Recover only an actual recorded delivery-completion event for legacy rows.
ALTER TABLE projects ADD COLUMN completed_at timestamptz;
UPDATE projects p
SET completed_at = (
  SELECT min(h.occurred_at)
  FROM opportunity_history h
  WHERE h.opportunity_id = p.opportunity_id
    AND h.event_type = 'delivery_status_changed' AND h.to_status = 'completed'
    AND h.source = 'live'
)
WHERE p.status = 'completed';

ALTER TABLE projects ADD CONSTRAINT projects_completion_state_check
  CHECK (status = 'completed' OR completed_at IS NULL);

CREATE FUNCTION maintain_project_completed_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, clock_timestamp());
  ELSIF OLD.status <> 'completed' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, clock_timestamp());
  ELSE
    -- Preserve both known completion times and unknown legacy dates on edits.
    NEW.completed_at := OLD.completed_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_completed_at
BEFORE INSERT OR UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION maintain_project_completed_at();

CREATE INDEX projects_completed_at_idx ON projects (completed_at, id)
WHERE status = 'completed';

COMMENT ON COLUMN project_benefits.recorded_on IS
  'Measurement date; first recognition date when an explicit recurrence is assigned.';
COMMENT ON COLUMN project_benefits.recurrence IS
  'Unspecified legacy records must be classified before US11 recognition; never infer recurrence from unit.';
COMMENT ON COLUMN project_benefits.recurs_until IS
  'Inclusive final recognition date for an explicit monthly or yearly schedule.';
COMMENT ON COLUMN projects.completed_at IS
  'First recorded completion timestamp; null for legacy completed projects without a reliable completion event.';
