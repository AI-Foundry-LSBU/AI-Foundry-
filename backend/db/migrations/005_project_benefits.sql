CREATE TABLE project_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (
    category IN ('efficiency', 'financial', 'service', 'risk_reduction', 'data', 'strategic')
  ),
  description varchar(2000) NOT NULL CHECK (char_length(btrim(description)) > 0),
  measurement varchar(200) NOT NULL CHECK (char_length(btrim(measurement)) > 0),
  estimated numeric(13,4) NOT NULL CHECK (estimated BETWEEN -999999999.9999 AND 999999999.9999),
  actual numeric(13,4) NOT NULL CHECK (actual BETWEEN -999999999.9999 AND 999999999.9999),
  unit text NOT NULL CHECK (unit IN ('Hours/month', 'GBP/year', 'Percent', 'Days', 'Cases/month')),
  recorded_on date NOT NULL,
  notes varchar(2000),
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX project_benefits_project_date_idx
  ON project_benefits (project_id, recorded_on DESC, id DESC);
