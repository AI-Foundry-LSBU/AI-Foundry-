CREATE TABLE opportunity_decisions (
  opportunity_id uuid PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
  decided_by uuid NOT NULL REFERENCES users(id),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason varchar(2000),
  decided_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (decision <> 'rejected' OR COALESCE(char_length(btrim(reason)), 0) > 0)
);
