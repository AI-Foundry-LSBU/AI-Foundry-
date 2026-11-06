CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email <> '' AND email = lower(btrim(email))),
  name text NOT NULL CHECK (char_length(btrim(name)) > 0),
  role text NOT NULL CHECK (role IN ('staff', 'manager', 'team'))
);

CREATE TABLE opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL REFERENCES users(id),
  title varchar(150) NOT NULL CHECK (char_length(btrim(title)) > 0),
  department varchar(100) NOT NULL CHECK (char_length(btrim(department)) > 0),
  problem_description varchar(2000) NOT NULL CHECK (char_length(btrim(problem_description)) > 0),
  proposed_improvement varchar(2000) NOT NULL CHECK (char_length(btrim(proposed_improvement)) > 0),
  expected_benefits varchar(500),
  status text NOT NULL DEFAULT 'submitted' CHECK (
    status IN ('submitted', 'in_assessment', 'approved', 'rejected', 'in_progress', 'completed')
  ),
  source text NOT NULL DEFAULT 'staff_submission' CHECK (source IN ('staff_submission', 'hackathon')),
  hackathon_name text CHECK (hackathon_name IS NULL OR source = 'hackathon'),
  priority text CHECK (priority IN ('high', 'medium', 'low')),
  category text CHECK (category IN ('automation', 'ai_assistant', 'reporting', 'process_improvement', 'other')),
  submitted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX opportunities_owner_submitted_idx
  ON opportunities (submitted_by, submitted_at DESC, id DESC);
