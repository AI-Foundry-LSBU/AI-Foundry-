CREATE TABLE opportunity_assessments (
  opportunity_id uuid PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
  assessed_by uuid NOT NULL REFERENCES users(id),
  strategic_alignment smallint NOT NULL CHECK (strategic_alignment BETWEEN 1 AND 5),
  benefit_potential smallint NOT NULL CHECK (benefit_potential BETWEEN 1 AND 5),
  complexity smallint NOT NULL CHECK (complexity BETWEEN 1 AND 5),
  resource_requirements smallint NOT NULL CHECK (resource_requirements BETWEEN 1 AND 5),
  speed_to_value smallint NOT NULL CHECK (speed_to_value BETWEEN 1 AND 5),
  notes varchar(2000),
  assessed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
